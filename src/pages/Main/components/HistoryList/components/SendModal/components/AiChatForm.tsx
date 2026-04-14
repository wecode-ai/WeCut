import { Form, Input, Tag } from "antd";
import { isString } from "es-toolkit/compat";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import LocalImage from "@/components/LocalImage";
import UnoIcon from "@/components/UnoIcon";
import type { DatabaseSchemaHistory } from "@/types/database";
import { isImage } from "@/utils/is";

interface AiChatFormProps {
  form: any;
  inputRef: React.RefObject<any>;
  item?: DatabaseSchemaHistory;
}

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

// 渲染预览内容
const ContentPreview = ({ item }: { item?: DatabaseSchemaHistory | null }) => {
  if (!item) return null;

  const type = item.type;

  // 图片类型：显示缩略图
  if (type === "image" && isString(item.value)) {
    return (
      <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <UnoIcon className="text-blue-500" name="i-lucide:image" size={16} />
          <span className="font-medium text-gray-700 text-sm">图片</span>
          <Tag className="text-xs">{getTypeLabel(type)}</Tag>
        </div>
        <div className="flex justify-center">
          <LocalImage
            className="max-h-32 max-w-full rounded object-contain"
            src={item.value}
          />
        </div>
      </div>
    );
  }

  // 文件类型
  if (type === "files" && Array.isArray(item.value)) {
    const files = item.value;
    const isSingleImage = files.length === 1 && isImage(files[0]);

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
        {isSingleImage ? (
          <div className="flex justify-center">
            <LocalImage
              className="max-h-32 max-w-full rounded object-contain"
              src={files[0]}
            />
          </div>
        ) : (
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
        )}
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

const AiChatForm = ({ form, inputRef, item }: AiChatFormProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <Form form={form} initialValues={{ extraMessage: "" }}>
      {/* 剪贴板内容预览 */}
      <ContentPreview item={item} />

      <Form.Item className="mb-0!" name="extraMessage">
        <Input.TextArea
          autoComplete="off"
          placeholder={t("component.send_modal.hints.input_extra_message")}
          ref={inputRef}
          rows={4}
        />
      </Form.Item>
    </Form>
  );
};

export default AiChatForm;
