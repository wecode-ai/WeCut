import { readFile } from "@tauri-apps/plugin-fs";
import { open as openUrl } from "@tauri-apps/plugin-opener";
import { useBoolean } from "ahooks";
import { Button, Form, Modal, notification, Space, Typography } from "antd";
import { find, isString } from "es-toolkit/compat";
import { t } from "i18next";
import {
  forwardRef,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useSnapshot } from "valtio";
import { useShortcutContext } from "@/contexts/ShortcutContext";
import { MainContext } from "@/pages/Main";
import { clipboardStore } from "@/stores/clipboard";
import type { DatabaseSchemaHistory } from "@/types/database";
import { isImage } from "@/utils/is";
import AiChatForm from "./components/AiChatForm";
import WorkQueueForm from "./components/WorkQueueForm";

export interface SendModalRef {
  open: (id: string, serviceType?: "aiChat" | "workQueue") => void;
}

interface AiChatFormFields {
  extraMessage: string;
}

interface WorkQueueFormFields {
  content: string;
  title: string;
  note: string;
  priority: "normal" | "high" | "low";
  senderExternalId: string;
  senderDisplayName: string;
  sourceType: string;
  sourceName: string;
}

// 读取图片文件并转为 base64
const readImageAsBase64 = async (path: string): Promise<string> => {
  const uint8Array = await readFile(path);
  const blob = new Blob([uint8Array]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// 构建文本类型的 content
const buildTextContent = (
  value: string | string[],
  extraMessage?: string,
): string => {
  const textValue = isString(value) ? value : JSON.stringify(value);
  let content = `<paste_content>\n${textValue}\n</paste_content>`;

  if (extraMessage) {
    content += `\n\n<extra>\n${extraMessage}\n</extra>`;
  }

  return content;
};

// 构建图片类型的 content (OpenAI Responses API 格式)
const buildImageContent = async (
  imagePath: string,
  extraMessage?: string,
): Promise<
  Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  >
> => {
  const base64Image = await readImageAsBase64(imagePath);
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  > = [
    {
      image_url: base64Image,
      type: "input_image",
    },
  ];

  if (extraMessage) {
    content.unshift({
      text: extraMessage,
      type: "input_text",
    });
  } else {
    content.unshift({
      text: "请分析这张图片",
      type: "input_text",
    });
  }

  return content;
};

// 发送消息到 Work Queue，返回响应体
const sendToWorkQueue = async (
  config: { baseUrl: string; apiToken: string; queueName: string },
  payload: {
    content: string;
    title?: string;
    note?: string;
    priority: string;
    sender?: { externalId: string; displayName: string };
    source?: { type: string; name: string };
  },
): Promise<Record<string, unknown>> => {
  const url = `${config.baseUrl}/api/work-queues/by-name/${config.queueName}/messages/ingest`;

  const response = await fetch(url, {
    body: JSON.stringify({
      content: payload.content,
      note: payload.note || undefined,
      priority: payload.priority,
      sender: payload.sender?.externalId
        ? {
            displayName: payload.sender.displayName,
            externalId: payload.sender.externalId,
          }
        : undefined,
      source: payload.source?.type
        ? {
            name: payload.source.name,
            type: payload.source.type,
          }
        : undefined,
      title: payload.title || undefined,
    }),
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
};

const SendModal = forwardRef<SendModalRef>((_, ref) => {
  const { rootState } = useContext(MainContext);
  const [open, { toggle }] = useBoolean();
  const [item, setItem] = useState<DatabaseSchemaHistory>();
  const [aiChatForm] = Form.useForm<AiChatFormFields>();
  const [workQueueForm] = Form.useForm<WorkQueueFormFields>();
  const inputRef = useRef<any>(null);
  const { wegent, aiSend, aiChatConfig, workQueueConfig } =
    useSnapshot(clipboardStore);
  const [currentServiceType, setCurrentServiceType] = useState<
    "aiChat" | "workQueue"
  >("aiChat");

  // Push modal context when open
  useShortcutContext(open ? "modal" : "normal");

  // 错误详情弹窗状态
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorDetail, setErrorDetail] = useState({ content: "", title: "" });

  // Work Queue 发送结果弹窗状态
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultTaskUrl, setResultTaskUrl] = useState<string | undefined>(
    undefined,
  );

  useImperativeHandle(ref, () => ({
    open: (id, serviceType) => {
      const findItem = find(rootState.list, { id });

      // 确定服务类型：优先使用传入的参数，其次根据启用的服务决定
      let targetServiceType: "aiChat" | "workQueue";
      if (serviceType) {
        targetServiceType = serviceType;
      } else if (wegent?.aiChat?.enabled && !wegent?.workQueue?.enabled) {
        targetServiceType = "aiChat";
      } else if (!wegent?.aiChat?.enabled && wegent?.workQueue?.enabled) {
        targetServiceType = "workQueue";
      } else {
        // 默认使用 aiChat，或者从旧配置迁移
        targetServiceType = aiSend?.serviceType || "aiChat";
      }

      setCurrentServiceType(targetServiceType);

      if (targetServiceType === "aiChat") {
        aiChatForm.resetFields();
      } else {
        workQueueForm.resetFields();
      }

      setItem(findItem);
      toggle();
    },
  }));

  // 显示错误详情弹窗
  const showErrorDetail = (title: string, content: string) => {
    setErrorDetail({ content, title });
    setErrorModalOpen(true);
  };

  // 复制错误信息到剪贴板
  const copyErrorToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(errorDetail.content);
      notification.success({
        duration: 2,
        message: "已复制到剪贴板",
      });
    } catch {
      notification.error({
        duration: 2,
        message: "复制失败",
      });
    }
  };

  // 发送消息到 AI Chat (OpenAI)
  const sendToAiChatAsync = async (
    messageContent:
      | string
      | Array<
          | { type: "input_text"; text: string }
          | { type: "input_image"; image_url: string }
        >,
  ) => {
    const config = wegent?.aiChat || aiChatConfig;
    if (!config) return;

    try {
      const response = await fetch(`${config.baseUrl}/v1/responses`, {
        body: JSON.stringify({
          input: [
            {
              content: messageContent,
              role: "user",
            },
          ],
          model: config.model || "default#wegent-chat",
        }),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...(config.customHeaders || {}),
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("component.send_modal.error.unknown");

      notification.error({
        description: (
          <div>
            <div style={{ marginBottom: 8 }}>
              {errorMessage.length > 100
                ? `${errorMessage.substring(0, 100)}...`
                : errorMessage}
            </div>
            <Button
              onClick={() =>
                showErrorDetail(
                  t("component.send_modal.error.title"),
                  errorMessage,
                )
              }
              size="small"
              type="link"
            >
              查看详情/复制
            </Button>
          </div>
        ),
        duration: 5,
        message: t("component.send_modal.error.title"),
        placement: "topRight",
      });
    }
  };

  // 发送消息到 Work Queue，成功返回响应数据，失败返回 null 并展示错误通知
  const sendToWorkQueueAsync = async (
    payload: WorkQueueFormFields,
  ): Promise<Record<string, unknown> | null> => {
    const config = wegent?.workQueue || workQueueConfig;
    if (!config) return null;

    try {
      const result = await sendToWorkQueue(config, {
        content: payload.content,
        note: payload.note,
        priority: payload.priority,
        sender: payload.senderExternalId
          ? {
              displayName: payload.senderDisplayName,
              externalId: payload.senderExternalId,
            }
          : undefined,
        source: payload.sourceType
          ? {
              name: payload.sourceName,
              type: payload.sourceType,
            }
          : undefined,
        title: payload.title,
      });
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("component.send_modal.error.unknown");

      notification.error({
        description: (
          <div>
            <div style={{ marginBottom: 8 }}>
              {errorMessage.length > 100
                ? `${errorMessage.substring(0, 100)}...`
                : errorMessage}
            </div>
            <Button
              onClick={() =>
                showErrorDetail(
                  t("component.send_modal.error.title"),
                  errorMessage,
                )
              }
              size="small"
              type="link"
            >
              查看详情/复制
            </Button>
          </div>
        ),
        duration: 5,
        message: t("component.send_modal.error.title"),
        placement: "topRight",
      });
      return null;
    }
  };

  // 处理 AI Chat 发送
  const handleAiChatSend = async (extraMessage?: string) => {
    if (!item) return;
    const config = wegent?.aiChat || aiChatConfig;
    if (!config) return;

    // 文件类型检查
    if (item.type === "files") {
      const files = Array.isArray(item.value) ? item.value : [item.value];
      if (files.length === 1 && isImage(files[0])) {
        // 继续执行
      } else {
        notification.warning({
          description: t("component.send_modal.error.unsupported_type"),
          message: t("component.send_modal.error.title"),
          placement: "topRight",
        });
        return;
      }
    }

    try {
      let messageContent:
        | string
        | Array<
            | { type: "input_text"; text: string }
            | { type: "input_image"; image_url: string }
          >;

      if (item.type === "image") {
        const imagePath = isString(item.value) ? item.value : "";
        if (!imagePath) {
          throw new Error("图片路径无效");
        }
        messageContent = await buildImageContent(imagePath, extraMessage);
      } else if (item.type === "files") {
        const files = Array.isArray(item.value) ? item.value : [item.value];
        if (files.length === 1 && isString(files[0]) && isImage(files[0])) {
          messageContent = await buildImageContent(files[0], extraMessage);
        } else {
          throw new Error("暂不支持发送多个文件或非图片文件");
        }
      } else {
        messageContent = buildTextContent(item.value, extraMessage);
      }

      toggle();
      sendToAiChatAsync(messageContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("component.send_modal.error.unknown");

      notification.error({
        description: (
          <div>
            <div style={{ marginBottom: 8 }}>
              {errorMessage.length > 100
                ? `${errorMessage.substring(0, 100)}...`
                : errorMessage}
            </div>
            <Button
              onClick={() =>
                showErrorDetail(
                  t("component.send_modal.error.title"),
                  errorMessage,
                )
              }
              size="small"
              type="link"
            >
              查看详情/复制
            </Button>
          </div>
        ),
        duration: 5,
        message: t("component.send_modal.error.title"),
        placement: "topRight",
      });
    }
  };

  // 处理 Work Queue 发送
  const handleWorkQueueSend = async () => {
    if (!item) return;
    const config = wegent?.workQueue || workQueueConfig;
    if (!config) return;

    try {
      const values = await workQueueForm.validateFields();

      // 关闭发送弹窗
      toggle();

      // 发送请求并等待结果
      const result = await sendToWorkQueueAsync(values);

      // 发送成功，展示结果弹窗
      if (result !== null) {
        const taskUrl =
          typeof result.taskUrl === "string" ? result.taskUrl : undefined;
        setResultTaskUrl(taskUrl);
        setResultModalOpen(true);
      }
    } catch (error) {
      // 表单验证失败，不关闭弹窗
      if (error instanceof Error && error.message.includes("validation")) {
        return;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : t("component.send_modal.error.unknown");

      notification.error({
        description: (
          <div>
            <div style={{ marginBottom: 8 }}>
              {errorMessage.length > 100
                ? `${errorMessage.substring(0, 100)}...`
                : errorMessage}
            </div>
            <Button
              onClick={() =>
                showErrorDetail(
                  t("component.send_modal.error.title"),
                  errorMessage,
                )
              }
              size="small"
              type="link"
            >
              查看详情/复制
            </Button>
          </div>
        ),
        duration: 5,
        message: t("component.send_modal.error.title"),
        placement: "topRight",
      });
    }
  };

  const handleAfterOpenChange = (open: boolean) => {
    if (!open) return;
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (currentServiceType === "aiChat") {
      const { extraMessage } = aiChatForm.getFieldsValue();
      await handleAiChatSend(extraMessage);
    } else {
      await handleWorkQueueSend();
    }
  };

  // 获取内容预览
  const getContentPreview = (): string => {
    if (!item) return "";
    if (isString(item.value)) {
      return item.value.substring(0, 200);
    }
    return JSON.stringify(item.value).substring(0, 200);
  };

  const getModalTitle = () => {
    if (currentServiceType === "aiChat") {
      return t("component.send_modal.title.ai_chat");
    }
    return t("component.send_modal.title.work_queue");
  };

  // 在浏览器中打开任务链接
  const handleGoToTask = async () => {
    if (!resultTaskUrl) return;
    try {
      await openUrl(resultTaskUrl);
    } catch {
      notification.error({
        duration: 3,
        message: t("component.send_modal.error.unknown"),
        placement: "topRight",
      });
    }
  };

  return (
    <>
      <Modal
        afterOpenChange={handleAfterOpenChange}
        centered
        footer={
          <Space>
            <Button onClick={toggle}>
              {t("component.send_modal.button.cancel")}
            </Button>
            <Button onClick={handleSend} type="primary">
              {t("component.send_modal.button.send")}
            </Button>
          </Space>
        }
        forceRender
        onCancel={toggle}
        open={open}
        title={getModalTitle()}
      >
        {currentServiceType === "aiChat" ? (
          <AiChatForm form={aiChatForm} inputRef={inputRef} item={item} />
        ) : (
          <WorkQueueForm
            contentPreview={getContentPreview()}
            form={workQueueForm}
          />
        )}
      </Modal>

      {/* 错误详情弹窗 */}
      <Modal
        cancelText="关闭"
        footer={
          <Space>
            <Button onClick={copyErrorToClipboard} type="primary">
              复制错误信息
            </Button>
            <Button onClick={() => setErrorModalOpen(false)}>关闭</Button>
          </Space>
        }
        onCancel={() => setErrorModalOpen(false)}
        open={errorModalOpen}
        title={errorDetail.title}
        width={800}
      >
        <Typography.Paragraph>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              borderRadius: 4,
              maxHeight: 400,
              overflow: "auto",
              padding: 16,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            <code>{errorDetail.content}</code>
          </pre>
        </Typography.Paragraph>
      </Modal>

      {/* Work Queue 发送结果弹窗 */}
      <Modal
        centered
        footer={
          <Space>
            <Button onClick={() => setResultModalOpen(false)}>
              {t("component.send_modal.button.close")}
            </Button>
            {resultTaskUrl && (
              <Button onClick={handleGoToTask} type="primary">
                {t("component.send_modal.button.go_to_task")}
              </Button>
            )}
          </Space>
        }
        onCancel={() => setResultModalOpen(false)}
        open={resultModalOpen}
        title={t("component.send_modal.result.title")}
      >
        <Typography.Paragraph>
          {t("component.send_modal.result.description")}
        </Typography.Paragraph>
      </Modal>
    </>
  );
});

export default SendModal;
