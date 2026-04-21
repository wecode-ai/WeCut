import { Button, Form, Input, Modal, notification, Tooltip } from "antd";
import { isString } from "es-toolkit/compat";
import { t } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSnapshot } from "valtio";
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
import {
  fetchWorkQueues,
  handleWorkQueueSend,
  type WorkQueueItem,
} from "@/utils/send";
import ImagePreviewWithOcr from "../ImagePreviewWithOcr";

const { TextArea } = Input;

/** 内容超过此字节数时将转为附件发送 */
const CONTENT_ATTACHMENT_THRESHOLD = 2048;

interface FormFields {
  title: string;
  note: string;
  /** 发送内容（仅文本类型时显示，可手动输入覆盖剪切板原文） */
  content: string;
  /** 目标队列名称 */
  queueName: string;
}

// 检查 Work Queue 配置是否有效（只需要 apiToken 和 baseUrl，queueName 由表单选择）
const isWorkQueueConfigValid = (
  config: typeof clipboardStore.workQueueConfig,
): boolean => {
  return !!(
    config?.apiToken &&
    config.apiToken.trim() !== "" &&
    config?.baseUrl &&
    config.baseUrl.trim() !== ""
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

  const isLarge =
    new TextEncoder().encode(preview).length > CONTENT_ATTACHMENT_THRESHOLD;

  return (
    <div className="content-preview-section">
      <div className="section-label">
        <UnoIcon name="i-lucide:file-text" size={14} />
        <span>内容</span>
        {isLarge && (
          <Tooltip
            title={t(
              "component.send_modal.work_queue.hint.large_content_as_attachment",
              "内容超过 2KB，将作为文本附件发送",
            )}
          >
            <span className="content-size-badge">
              <UnoIcon name="i-lucide:paperclip" size={12} />
              <span>
                {t(
                  "component.send_modal.work_queue.hint.as_attachment",
                  "附件",
                )}
              </span>
            </span>
          </Tooltip>
        )}
      </div>
      <div className="content-preview-box">
        <pre className="preview-text">{preview}</pre>
      </div>
    </div>
  );
};

// 内容字段标签（带超大内容附件提示）
const ContentFieldLabel = ({ value }: { value: string }) => {
  const isLarge =
    new TextEncoder().encode(value).length > CONTENT_ATTACHMENT_THRESHOLD;
  return (
    <span style={{ alignItems: "center", display: "inline-flex", gap: 4 }}>
      {t("component.send_modal.work_queue.label.content", "内容")}
      {isLarge && (
        <Tooltip
          title={t(
            "component.send_modal.work_queue.hint.large_content_as_attachment",
            "内容超过 2KB，将作为文本附件发送",
          )}
        >
          <span
            style={{
              alignItems: "center",
              color: "var(--ant-color-warning)",
              cursor: "default",
              display: "inline-flex",
              fontSize: 11,
              gap: 2,
            }}
          >
            <UnoIcon name="i-lucide:paperclip" size={11} />
            {t("component.send_modal.work_queue.hint.as_attachment", "附件")}
          </span>
        </Tooltip>
      )}
    </span>
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

// ============================================================
// InboxPicker: 搜索 + 网格卡片选择器（替代 Select 下拉框）
// ============================================================
interface InboxPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  queues: WorkQueueItem[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
}

const InboxPicker = ({
  value,
  onChange,
  queues,
  loading,
  search,
  onSearchChange,
}: InboxPickerProps) => {
  const filtered = useMemo(() => {
    if (!search.trim()) return queues;
    const kw = search.trim().toLowerCase();
    return queues.filter(
      (q) =>
        (q.displayName || q.name).toLowerCase().includes(kw) ||
        q.name.toLowerCase().includes(kw),
    );
  }, [queues, search]);

  return (
    <div className="inbox-picker">
      {/* 搜索框：绝对定位到 Form.Item label 行右侧 */}
      <div className="inbox-picker-search">
        <UnoIcon
          className="inbox-picker-search-icon"
          name="i-lucide:search"
          size={11}
        />
        <input
          className="inbox-picker-search-input"
          onChange={(e) => onSearchChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder={t(
            "component.send_modal.work_queue.placeholder.search_queue",
            "搜索…",
          )}
          type="text"
          value={search}
        />
        {search && (
          <button
            className="inbox-picker-search-clear"
            onClick={(e) => {
              e.stopPropagation();
              onSearchChange("");
            }}
            type="button"
          >
            <UnoIcon name="i-lucide:x" size={10} />
          </button>
        )}
      </div>

      {/* 卡片网格 */}
      <div className="inbox-picker-grid">
        {loading ? (
          <div className="inbox-picker-empty">
            <UnoIcon name="i-lucide:loader-circle" size={14} />
            <span>
              {t("component.send_modal.work_queue.loading_queues", "加载中…")}
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="inbox-picker-empty">
            <UnoIcon name="i-lucide:inbox" size={14} />
            <span>
              {search
                ? t(
                    "component.send_modal.work_queue.no_match_queues",
                    "无匹配队列",
                  )
                : t("component.send_modal.work_queue.no_queues", "暂无队列")}
            </span>
          </div>
        ) : (
          filtered.map((q) => {
            const label = q.displayName || q.name;
            const isSelected = value === q.name;
            return (
              <button
                className={["inbox-card", isSelected && "inbox-card--selected"]
                  .filter(Boolean)
                  .join(" ")}
                key={q.name}
                onClick={() => onChange?.(q.name)}
                title={label}
                type="button"
              >
                <UnoIcon
                  className="inbox-card-icon"
                  name={
                    isSelected ? "i-lucide:check-circle-2" : "i-lucide:inbox"
                  }
                  size={14}
                />
                <span className="inbox-card-name">{label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

const WorkQueueForm = () => {
  const [form] = Form.useForm<FormFields>();
  const { wegent, workQueueConfig } = useSnapshot(clipboardStore);
  const [item, setItem] = useState<DatabaseSchemaHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [queues, setQueues] = useState<WorkQueueItem[]>([]);
  const [loadingQueues, setLoadingQueues] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const contentRef = useRef<any>(null);

  // 优先使用新的 wegent 配置，兼容旧配置
  const effectiveConfig = wegent?.workQueue || workQueueConfig;

  const baseUrl = effectiveConfig?.baseUrl || DEFAULTS.WORK_QUEUE_URL;
  const apiToken = effectiveConfig?.apiToken || "";
  const _defaultQueueName = effectiveConfig?.queueName || "";

  // 加载队列列表
  const loadQueues = useCallback(async () => {
    if (!baseUrl || !apiToken) {
      setQueues([]);
      return;
    }
    setLoadingQueues(true);
    try {
      const result = await fetchWorkQueues(baseUrl, apiToken);
      setQueues(result);
    } finally {
      setLoadingQueues(false);
    }
  }, [baseUrl, apiToken]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  // 加载剪贴板项目并监听数据变化
  useEffect(() => {
    const loadItem = () => {
      const currentItem = getCurrentSendItem();
      setItem(currentItem);

      form.setFieldsValue({
        content: "",
        note: effectiveConfig?.defaults?.note || "",
        queueName: effectiveConfig?.queueName || "",
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

  const handleSubmit = useCallback(async () => {
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
        const isTextType =
          item.type === "text" || item.type === "html" || item.type === "rtf";
        const isFilesType = item.type === "files" || item.type === "image";

        if (isTextType) {
          const value = item.value as unknown;
          if (isString(value)) {
            content = value;
          } else if (Array.isArray(value)) {
            content = value.join(", ");
          }
          // 文本类型：允许用户在 content 输入框中覆盖原始内容
          if (values.content?.trim()) {
            content = values.content.trim();
          }
        }

        if (isFilesType) {
          if (item.type === "files") {
            files = Array.isArray(item.value) ? item.value : [item.value];
          } else if (item.type === "image") {
            files = isString(item.value) ? [item.value] : [];
          }
          // 附件模式：不显示 content 输入框，content 保持 undefined，只发附件
        }
      }

      // 使用用户在表单中选择的队列名称（覆盖配置中的默认值）
      const selectedQueueName =
        values.queueName || effectiveConfig?.queueName || "";
      const configWithSelectedQueue = effectiveConfig
        ? { ...effectiveConfig, queueName: selectedQueueName }
        : effectiveConfig;

      await handleWorkQueueSend(configWithSelectedQueue, {
        content,
        files,
        note: values.note,
        title: values.title,
      });

      // 显示成功弹窗，用户关闭后再关闭窗口
      setSuccessModalOpen(true);
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
  }, [effectiveConfig, form, item]);

  const handleSuccessModalClose = useCallback(async () => {
    setSuccessModalOpen(false);
    setCountdown(10);
    await closeCurrentSendModal();
  }, []);

  // 成功弹窗显示时：10s 倒计时自动关闭 + 回车键关闭
  useEffect(() => {
    if (!successModalOpen) return;

    setCountdown(10);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const autoCloseTimer = setTimeout(() => {
      handleSuccessModalClose();
    }, 10000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSuccessModalClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(interval);
      clearTimeout(autoCloseTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [successModalOpen, handleSuccessModalClose]);

  const handleCancel = async () => {
    await closeCurrentSendModal();
  };

  // 判断是否有文本内容（用于显示预览）
  const hasContent =
    item?.type === "text" || item?.type === "html" || item?.type === "rtf";

  // 判断是否有文件内容（附件模式）
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSubmit]);

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
          {/* 队列选择 - 卡片网格选择器 */}
          <Form.Item
            label={t(
              "component.send_modal.work_queue.label.queue_name",
              "队列",
            )}
            name="queueName"
            rules={[
              {
                message: t(
                  "component.send_modal.work_queue.validation.queue_required",
                  "请选择队列",
                ),
                required: true,
              },
            ]}
            style={{ position: "relative" }}
          >
            <InboxPicker
              loading={loadingQueues}
              onSearchChange={setQueueSearch}
              queues={queues}
              search={queueSearch}
            />
          </Form.Item>

          {/* 内容字段：仅文本类型（非附件模式）时显示，附件模式只能填备注 */}
          {!hasFiles && (
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.content !== cur.content}
            >
              {({ getFieldValue }) => (
                <Form.Item
                  label={
                    <ContentFieldLabel value={getFieldValue("content") || ""} />
                  }
                  name="content"
                >
                  <TextArea
                    autoComplete="off"
                    placeholder={t(
                      "component.send_modal.work_queue.placeholder.content",
                      "可选",
                    )}
                    ref={contentRef}
                    rows={4}
                  />
                </Form.Item>
              )}
            </Form.Item>
          )}

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

      {/* 发送成功弹窗 */}
      <Modal
        centered
        footer={
          <Button onClick={handleSuccessModalClose} type="primary">
            {t("component.send_modal.button.close", "关闭")} ({countdown}s)
          </Button>
        }
        onCancel={handleSuccessModalClose}
        open={successModalOpen}
        title={t("component.send_modal.result.title", "发送成功")}
      >
        <p>
          {t("component.send_modal.result.description", "已成功发送到任务队列")}
        </p>
      </Modal>

      {/* 固定在底部的操作按钮 */}
      <div className="send-modal-actions">
        <button
          className="sm-btn sm-btn-default"
          onClick={handleCancel}
          type="button"
        >
          {t("component.send_modal.button.cancel")}
        </button>
        <button
          className="sm-btn sm-btn-primary"
          disabled={loading}
          onClick={handleSubmit}
          type="button"
        >
          {loading ? "发送中…" : t("component.send_modal.button.send")}
        </button>
      </div>
    </div>
  );
};

export default WorkQueueForm;
