import { Button, Form, Input, notification, Space } from "antd";
import { isString } from "es-toolkit/compat";
import { t } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import UnoIcon from "@/components/UnoIcon";
import {
  closeCurrentSendModal,
  getCurrentSendItem,
  listenSendModalData,
} from "@/plugins/sendModal";
import { clipboardStore } from "@/stores/clipboard";
import type { DatabaseSchemaHistory } from "@/types/database";
import { isImage } from "@/utils/is";
import { handleWorkQueueSend } from "@/utils/send";
import ImagePreviewWithOcr from "../ImagePreviewWithOcr";

const { TextArea } = Input;

interface FormFields {
  title: string;
  note: string;
  /** 发送内容（常驻字段，可手动输入，图片类型时可通过 OCR 填入） */
  content: string;
}

// 检查 Work Queue 配置是否有效
const isWorkQueueConfigValid = (
  config: typeof clipboardStore.workQueueConfig,
): boolean => {
  return !!(
    config?.apiToken &&
    config.apiToken.trim() !== "" &&
    config?.baseUrl &&
    config.baseUrl.trim() !== "" &&
    config?.queueName &&
    config.queueName.trim() !== ""
  );
};

// 渲染文件列表（非图片文件）
const FileList = ({ files }: { files: string[] }) => {
  return (
    <div className="file-list">
      {files.map((file) => {
        const isImg = isImage(file);
        const fileName =
          file.split("/").pop() || file.split("\\").pop() || file;
        return (
          <div className="file-item" key={file}>
            <UnoIcon
              name={isImg ? "i-lucide:image" : "i-lucide:file-text"}
              size={16}
            />
            <span className="file-name">{fileName}</span>
          </div>
        );
      })}
    </div>
  );
};

// 内容预览（纯文本类型）
const ContentPreview = ({ item }: { item?: DatabaseSchemaHistory | null }) => {
  if (!item) return null;

  const hasText =
    item.type === "text" || item.type === "html" || item.type === "rtf";

  if (!hasText) return null;

  let preview = "";
  const value = item.value as unknown;
  if (isString(value)) {
    preview = value;
  } else if (Array.isArray(value)) {
    preview = value.join(", ");
  }

  return (
    <div className="content-preview-section">
      <div className="section-label">
        <UnoIcon name="i-lucide:file-text" size={14} />
        <span>内容</span>
      </div>
      <div className="content-preview-box">
        <pre className="preview-text">{preview}</pre>
      </div>
    </div>
  );
};

// 文件列表区域（图片/文件类型）
const FilesSection = ({
  item,
  files,
  onOcrResult,
}: {
  item?: DatabaseSchemaHistory | null;
  files: string[];
  onOcrResult: (text: string) => void;
}) => {
  if (!item || files.length === 0) return null;

  const isItemImage = item.type === "image";
  // 单张图片文件：显示图片预览 + OCR
  const isSingleImage =
    files.length === 1 && isString(files[0]) && isImage(files[0]);

  if (isSingleImage) {
    return (
      <div className="files-section">
        <div className="section-label">
          <UnoIcon name="i-lucide:image" size={14} />
          <span>图片</span>
        </div>
        <ImagePreviewWithOcr
          imagePath={files[0]}
          onOcrResult={onOcrResult}
          showFillButton
        />
      </div>
    );
  }

  const label = isItemImage ? "文件列表" : `文件列表 (${files.length}个文件)`;

  return (
    <div className="files-section">
      <div className="section-label">
        <UnoIcon name="i-lucide:folder" size={14} />
        <span>{label}</span>
      </div>
      <FileList files={files} />
    </div>
  );
};

const WorkQueueForm = () => {
  const [form] = Form.useForm<FormFields>();
  const { wegent, workQueueConfig } = useSnapshot(clipboardStore);
  const [item, setItem] = useState<DatabaseSchemaHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const contentRef = useRef<any>(null);

  // 优先使用新的 wegent 配置，兼容旧配置
  const effectiveConfig = wegent?.workQueue || workQueueConfig;

  // 加载剪贴板项目并监听数据变化
  useEffect(() => {
    const loadItem = () => {
      const currentItem = getCurrentSendItem();
      setItem(currentItem);

      form.setFieldsValue({
        content: "",
        note: effectiveConfig?.defaults?.note || "",
        title: effectiveConfig?.defaults?.title || "",
      });
    };

    // 初始加载
    loadItem();

    // 监听数据变化（当窗口已打开时点击不同历史记录）
    const unlisten = listenSendModalData(() => {
      loadItem();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [form, effectiveConfig]);

  // OCR 结果填入 content 字段，并附加提示词前缀
  const handleOcrResult = (text: string) => {
    const current = form.getFieldValue("content") || "";
    const prefix = current
      ? ""
      : t(
          "component.send_modal.work_queue.ocr_prefix",
          "以下是图片中识别到的文字内容：\n",
        );
    const newValue = `${prefix}${current}${current ? "\n" : ""}${text}`;
    form.setFieldValue("content", newValue);
    contentRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!isWorkQueueConfigValid(effectiveConfig)) {
      notification.warning({
        description: (
          <div>
            <div style={{ marginBottom: 8 }}>
              {t("component.send_modal.error.work_queue_not_configured")}
            </div>
            <Button
              onClick={() => {
                closeCurrentSendModal();
                import("@tauri-apps/api/core").then(({ invoke }) => {
                  invoke("plugin:eco-window|show_window", {
                    label: "preference",
                  });
                });
              }}
              size="small"
              type="link"
            >
              {t("component.send_modal.action.open_settings")}
            </Button>
          </div>
        ),
        duration: 0,
        message: t("component.send_modal.error.config_required"),
        placement: "topRight",
      });
      return;
    }

    const values = await form.validateFields();

    setLoading(true);

    try {
      let content: string | undefined;
      let files: string[] | undefined;

      if (item) {
        const hasText =
          item.type === "text" || item.type === "html" || item.type === "rtf";
        const hasFiles = item.type === "files" || item.type === "image";

        if (hasText) {
          const value = item.value as unknown;
          if (isString(value)) {
            content = value;
          } else if (Array.isArray(value)) {
            content = value.join(", ");
          }
        }

        if (hasFiles) {
          if (item.type === "files") {
            files = Array.isArray(item.value) ? item.value : [item.value];
          } else if (item.type === "image") {
            files = isString(item.value) ? [item.value] : [];
          }
        }

        // content 字段（常驻）：如果有内容，覆盖自动提取的文本
        if (values.content?.trim()) {
          content = values.content.trim();
        }
      }

      await handleWorkQueueSend(effectiveConfig, {
        content,
        files,
        note: values.note,
        title: values.title,
      });

      notification.success({
        description: t("component.send_modal.success.work_queue_sent"),
        duration: 3,
        message: t("component.send_modal.success.title"),
      });

      await closeCurrentSendModal();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("component.send_modal.error.unknown");

      notification.error({
        description: errorMessage,
        duration: 5,
        message: t("component.send_modal.error.title"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await closeCurrentSendModal();
  };

  // 判断是否有文本内容（用于显示预览）
  const hasContent =
    item?.type === "text" || item?.type === "html" || item?.type === "rtf";

  // 判断是否有文件内容
  const hasFiles = item?.type === "files" || item?.type === "image";

  // 获取文件列表
  const fileList = (() => {
    if (!item) return [];
    if (item.type === "files") {
      return Array.isArray(item.value) ? item.value : [item.value];
    }
    if (item.type === "image") {
      return isString(item.value) ? [item.value] : [];
    }
    return [];
  })();

  return (
    <div className="work-queue-form-container">
      {/* 可滚动的内容区域 */}
      <div className="work-queue-form-content">
        {/* 内容预览区域（仅文本类型） */}
        {hasContent && <ContentPreview item={item} />}

        {/* 文件列表区域（仅图片/文件类型），图片时支持 OCR 填入 content */}
        {hasFiles && (
          <FilesSection
            files={fileList}
            item={item}
            onOcrResult={handleOcrResult}
          />
        )}

        <Form className="send-modal-form" form={form} layout="vertical">
          {/* 内容字段（常驻），可手动输入或通过 OCR 填入 */}
          <Form.Item
            label={t("component.send_modal.work_queue.label.content", "内容")}
            name="content"
          >
            <TextArea
              autoComplete="off"
              placeholder={t(
                "component.send_modal.work_queue.placeholder.content",
                "可选，图片类型可通过 OCR 识别后填入…",
              )}
              ref={contentRef}
              rows={4}
            />
          </Form.Item>

          <Form.Item
            label={t("component.send_modal.work_queue.label.title", "标题")}
            name="title"
          >
            <Input
              autoComplete="off"
              placeholder={t(
                "component.send_modal.work_queue.placeholder.optional",
                "可选",
              )}
            />
          </Form.Item>

          <Form.Item
            label={t("component.send_modal.work_queue.label.note", "备注")}
            name="note"
          >
            <TextArea
              autoComplete="off"
              placeholder={t(
                "component.send_modal.work_queue.placeholder.optional",
                "可选",
              )}
              rows={3}
            />
          </Form.Item>
        </Form>
      </div>

      {/* 固定在底部的操作按钮 */}
      <div className="send-modal-actions">
        <Space>
          <Button onClick={handleCancel} size="small">
            {t("component.send_modal.button.cancel")}
          </Button>
          <Button
            loading={loading}
            onClick={handleSubmit}
            size="small"
            type="primary"
          >
            {t("component.send_modal.button.send")}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default WorkQueueForm;
