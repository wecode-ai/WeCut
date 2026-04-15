import { Button, Form, Input, notification, Space, Tag } from "antd";
import { isString } from "es-toolkit/compat";
import { t } from "i18next";
import { useEffect, useRef, useState } from "react";
import UnoIcon from "@/components/UnoIcon";
import {
  closeCurrentSendModal,
  getCurrentSendItem,
  listenSendModalData,
} from "@/plugins/sendModal";
import { clipboardStore } from "@/stores/clipboard";
import type { DatabaseSchemaHistory } from "@/types/database";
import { DEFAULTS } from "@/utils/envConfig";
import { isImage } from "@/utils/is";
import { handleAiChatSend } from "@/utils/send";
import ImagePreviewWithOcr from "../ImagePreviewWithOcr";

const { TextArea } = Input;

interface FormFields {
  extraMessage: string;
}

// 检查 AI Chat 配置是否有效
const isAiChatConfigValid = (
  config: typeof clipboardStore.aiChatConfig,
): boolean => {
  return !!(
    config?.apiKey &&
    config.apiKey.trim() !== "" &&
    config?.baseUrl &&
    config.baseUrl.trim() !== ""
  );
};

// 快捷指令标签
const QUICK_TAGS = [
  {
    key: "summarize",
    label: t("component.send_modal.ai_chat.tag.summarize", "总结"),
  },
  {
    key: "translate",
    label: t("component.send_modal.ai_chat.tag.translate", "翻译"),
  },
  {
    key: "explain",
    label: t("component.send_modal.ai_chat.tag.explain", "解释"),
  },
  {
    key: "polish",
    label: t("component.send_modal.ai_chat.tag.polish", "润色"),
  },
];

// 清理预览文本（去除 HTML/RTF 标签）
const stripPreviewText = (value: string) => {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// 获取内容预览
const getContentPreview = (item: DatabaseSchemaHistory): string => {
  if (isString(item.value)) {
    return stripPreviewText(item.value).substring(0, 200);
  }
  if (Array.isArray(item.value)) {
    return item.value.join(", ").substring(0, 200);
  }
  return String(item.value).substring(0, 200);
};

// 获取类型标签文本
const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    files: "文件",
    html: "HTML",
    image: "图片",
    rtf: "富文本",
    text: "文本",
  };
  return labels[type] || type;
};

// 获取图片路径（从 item 中提取）
const getImagePath = (item: DatabaseSchemaHistory): string | null => {
  if (item.type === "image" && isString(item.value)) {
    return item.value;
  }
  if (item.type === "files" && Array.isArray(item.value)) {
    const files = item.value;
    if (files.length === 1 && isString(files[0]) && isImage(files[0])) {
      return files[0];
    }
  }
  return null;
};

// 渲染预览内容
const ContentPreview = ({
  item,
  onOcrResult,
}: {
  item?: DatabaseSchemaHistory | null;
  onOcrResult: (text: string) => void;
}) => {
  if (!item) return null;

  const type = item.type;
  const imagePath = getImagePath(item);

  // 图片类型：显示图片预览 + OCR
  if (imagePath) {
    return (
      <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <UnoIcon className="text-blue-500" name="i-lucide:image" size={16} />
          <span className="font-medium text-gray-700 text-sm">图片</span>
          <Tag className="text-xs">{getTypeLabel(type)}</Tag>
        </div>
        <ImagePreviewWithOcr
          imagePath={imagePath}
          onOcrResult={onOcrResult}
          showFillButton
        />
      </div>
    );
  }

  // 文件类型（多文件）
  if (type === "files" && Array.isArray(item.value)) {
    const files = item.value;
    return (
      <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <UnoIcon
            className="text-orange-500"
            name="i-lucide:folder"
            size={16}
          />
          <span className="font-medium text-gray-700 text-sm">
            {files.length === 1 ? "文件" : `${files.length} 个文件`}
          </span>
          <Tag className="text-xs">{getTypeLabel(type)}</Tag>
        </div>
        <div className="space-y-1">
          {files.slice(0, 4).map((file) => (
            <div
              className="flex items-center gap-2 truncate text-gray-600 text-sm"
              key={file}
            >
              <UnoIcon
                className="flex-shrink-0"
                name="i-lucide:file-text"
                size={14}
              />
              <span className="truncate">{file}</span>
            </div>
          ))}
          {files.length > 4 && (
            <div className="text-gray-400 text-xs">
              还有 {files.length - 4} 个文件...
            </div>
          )}
        </div>
      </div>
    );
  }

  // 文本/HTML/RTF 类型
  const previewText = getContentPreview(item);

  return (
    <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <UnoIcon
          className="text-green-500"
          name="i-lucide:file-text"
          size={16}
        />
        <span className="font-medium text-gray-700 text-sm">内容预览</span>
        <Tag className="text-xs">{getTypeLabel(type)}</Tag>
        {item.subtype && <Tag className="text-xs">{item.subtype}</Tag>}
      </div>
      <div className="max-h-24 overflow-hidden text-gray-600 text-sm">
        <pre className="whitespace-pre-wrap break-all font-sans">
          {previewText || "（空内容）"}
        </pre>
      </div>
    </div>
  );
};

const AiChatForm = () => {
  const [form] = Form.useForm<FormFields>();
  const inputRef = useRef<any>(null);
  const [item, setItem] = useState<DatabaseSchemaHistory | null>();

  // 加载剪贴板项目并监听数据变化
  useEffect(() => {
    const currentItem = getCurrentSendItem();
    setItem(currentItem);

    const unlisten = listenSendModalData(() => {
      const newItem = getCurrentSendItem();
      setItem(newItem);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // OCR 结果填入输入框
  const handleOcrResult = (text: string) => {
    const current = form.getFieldValue("extraMessage") || "";
    const newValue = current ? `${current}\n${text}` : text;
    form.setFieldValue("extraMessage", newValue);
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    const storedConfig = clipboardStore.aiChatConfig;
    const currentConfig = {
      apiKey: storedConfig?.apiKey || "",
      baseUrl: storedConfig?.baseUrl?.trim() || DEFAULTS.AI_CHAT_URL,
      customHeaders: storedConfig?.customHeaders || {},
      model: storedConfig?.model?.trim() || DEFAULTS.AI_MODEL,
    };

    if (!isAiChatConfigValid(currentConfig)) {
      notification.warning({
        description: (
          <div>
            <div style={{ marginBottom: 8 }}>
              {t("component.send_modal.error.ai_chat_not_configured")}
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
    const item = getCurrentSendItem();
    if (!item) {
      notification.error({
        description: t("component.send_modal.error.item_not_found"),
        duration: 5,
        message: t("component.send_modal.error.title"),
      });
      return;
    }

    handleAiChatSend(item, currentConfig, values.extraMessage).catch(() => {
      // 错误已在 handleAiChatSend 内部处理
    });

    await closeCurrentSendModal();
  };

  const handleCancel = async () => {
    await closeCurrentSendModal();
  };

  const handleTagClick = (tagKey: string) => {
    const tagTexts: Record<string, string> = {
      explain: t(
        "component.send_modal.ai_chat.tag_text.explain",
        "请解释以下内容：",
      ),
      polish: t(
        "component.send_modal.ai_chat.tag_text.polish",
        "请润色以下内容：",
      ),
      summarize: t(
        "component.send_modal.ai_chat.tag_text.summarize",
        "请总结以下内容：",
      ),
      translate: t(
        "component.send_modal.ai_chat.tag_text.translate",
        "请将以下内容翻译成英文：",
      ),
    };

    const currentValue = form.getFieldValue("extraMessage") || "";
    const newValue = currentValue
      ? `${currentValue}\n${tagTexts[tagKey]}`
      : tagTexts[tagKey];
    form.setFieldValue("extraMessage", newValue);
    inputRef.current?.focus();
  };

  return (
    <div className="ai-chat-form-container">
      <div className="ai-chat-form-content">
        <Form
          className="send-modal-form"
          form={form}
          initialValues={{ extraMessage: "" }}
        >
          {/* 剪贴板内容预览 */}
          <ContentPreview item={item} onOcrResult={handleOcrResult} />

          <Form.Item className="mb-0!" name="extraMessage">
            <TextArea
              autoComplete="off"
              placeholder={t("component.send_modal.hints.input_extra_message")}
              ref={inputRef}
              rows={4}
            />
          </Form.Item>

          {/* 快捷标签 */}
          <div className="quick-tags">
            {QUICK_TAGS.map((tag) => (
              <span
                className="quick-tag"
                key={tag.key}
                onClick={() => handleTagClick(tag.key)}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </Form>
      </div>

      {/* 底部按钮（固定在底部） */}
      <div className="send-modal-actions">
        <Space>
          <Button onClick={handleCancel} size="small">
            {t("component.send_modal.button.cancel")}
          </Button>
          <Button onClick={handleSubmit} size="small" type="primary">
            {t("component.send_modal.button.send")}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default AiChatForm;
