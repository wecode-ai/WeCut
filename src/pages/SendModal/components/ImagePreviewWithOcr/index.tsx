import { invoke } from "@tauri-apps/api/core";
import { notification, Spin, Tooltip } from "antd";
import { useState } from "react";
import LocalImage from "@/components/LocalImage";
import UnoIcon from "@/components/UnoIcon";
import { readImageAsBase64 } from "@/utils/send";

// OcrBlock 类型（与 screenshot.rs 返回格式一致）
export interface OcrBlock {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImagePreviewWithOcrProps {
  imagePath: string;
  /** OCR 识别完成后的回调，传入识别到的全部文字 */
  onOcrResult?: (text: string) => void;
  /** 是否显示"填入"按钮（AI Chat 模式需要，Work Queue 模式不需要） */
  showFillButton?: boolean;
}

const ImagePreviewWithOcr = ({
  imagePath,
  onOcrResult,
  showFillButton = true,
}: ImagePreviewWithOcrProps) => {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrBlocks, setOcrBlocks] = useState<OcrBlock[] | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showOcrPanel, setShowOcrPanel] = useState(false);

  const handleOcr = async () => {
    setOcrLoading(true);
    setOcrError(null);
    setOcrBlocks(null);
    setShowOcrPanel(true);

    try {
      const base64 = await readImageAsBase64(imagePath);
      const resultJson = await invoke<string>("ocr_image", {
        imageDataUrl: base64,
      });
      const blocks: OcrBlock[] = JSON.parse(resultJson);
      setOcrBlocks(blocks);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOcrError(msg);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCopyAll = async () => {
    if (!ocrBlocks || ocrBlocks.length === 0) return;
    const allText = ocrBlocks.map((b) => b.text).join("\n");
    try {
      await navigator.clipboard.writeText(allText);
      notification.success({ duration: 2, message: "已复制到剪贴板" });
    } catch {
      notification.error({ duration: 2, message: "复制失败" });
    }
  };

  const handleFillInput = () => {
    if (!ocrBlocks || ocrBlocks.length === 0) return;
    const allText = ocrBlocks.map((b) => b.text).join("\n");
    onOcrResult?.(allText);
    setShowOcrPanel(false);
    notification.success({ duration: 2, message: "已填入输入框" });
  };

  const handleCloseOcr = () => {
    setShowOcrPanel(false);
    setOcrBlocks(null);
    setOcrError(null);
  };

  return (
    <div className="image-preview-container">
      {/* 图片预览区域 */}
      <div className="image-preview-wrapper">
        <LocalImage className="image-preview-img" src={imagePath} />
        {/* OCR 触发按钮 */}
        <div className="image-preview-actions">
          <Tooltip title="识别图片中的文字 (OCR)">
            <button
              className="ocr-trigger-btn"
              disabled={ocrLoading}
              onClick={handleOcr}
              type="button"
            >
              {ocrLoading ? (
                <Spin size="small" />
              ) : (
                <UnoIcon name="i-lucide:scan-text" size={14} />
              )}
              <span>{ocrLoading ? "识别中…" : "OCR 识别"}</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* OCR 结果面板 */}
      {showOcrPanel && (
        <div className="ocr-result-panel">
          {/* 面板头部 */}
          <div className="ocr-result-header">
            <div className="ocr-result-title">
              <UnoIcon name="i-lucide:scan-text" size={13} />
              <span>
                {ocrLoading
                  ? "识别中…"
                  : ocrError
                    ? "识别失败"
                    : `识别到 ${ocrBlocks?.length ?? 0} 个文字块`}
              </span>
            </div>
            <div className="ocr-result-actions">
              {!ocrLoading && ocrBlocks && ocrBlocks.length > 0 && (
                <>
                  {showFillButton && onOcrResult && (
                    <Tooltip title="填入下方输入框">
                      <button
                        className="ocr-action-btn ocr-action-fill"
                        onClick={handleFillInput}
                        type="button"
                      >
                        <UnoIcon name="i-lucide:corner-down-left" size={11} />
                        填入
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip title="复制全部文字">
                    <button
                      className="ocr-action-btn ocr-action-copy"
                      onClick={handleCopyAll}
                      type="button"
                    >
                      <UnoIcon name="i-lucide:copy" size={11} />
                      复制
                    </button>
                  </Tooltip>
                </>
              )}
              <button
                className="ocr-action-btn ocr-action-close"
                onClick={handleCloseOcr}
                type="button"
              >
                <UnoIcon name="i-lucide:x" size={11} />
              </button>
            </div>
          </div>

          {/* 面板内容 */}
          <div className="ocr-result-content">
            {ocrLoading && (
              <div className="ocr-loading">
                <Spin size="small" />
                <span>正在识别图片文字…</span>
              </div>
            )}
            {ocrError && (
              <div className="ocr-error">
                <UnoIcon name="i-lucide:alert-circle" size={14} />
                <span>{ocrError}</span>
              </div>
            )}
            {!ocrLoading && ocrBlocks && ocrBlocks.length === 0 && (
              <div className="ocr-empty">
                <UnoIcon name="i-lucide:file-x" size={14} />
                <span>未识别到文字</span>
              </div>
            )}
            {!ocrLoading && ocrBlocks && ocrBlocks.length > 0 && (
              <div className="ocr-blocks">
                {ocrBlocks.map((block, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: OCR blocks have no stable unique id
                  <div className="ocr-block-item" key={idx}>
                    <span className="ocr-block-text">{block.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePreviewWithOcr;
