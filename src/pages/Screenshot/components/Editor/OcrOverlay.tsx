import { message } from "antd";
import UnoIcon from "@/components/UnoIcon";
import type { OcrBlock } from "../../hooks/useScreenshot";

interface OcrOverlayProps {
  visible: boolean;
  loading: boolean;
  blocks: OcrBlock[] | null;
  error: string | null;
  selW: number;
  selH: number;
  canvasOffsetX: number;
  onClose: () => void;
}

const OcrOverlay: React.FC<OcrOverlayProps> = ({
  visible,
  loading,
  blocks,
  error,
  selW,
  selH,
  canvasOffsetX,
  onClose,
}) => {
  if (!visible) return null;

  const handleCopyAll = async () => {
    if (!blocks || blocks.length === 0) return;
    const allText = blocks.map((b) => b.text).join("\n");
    try {
      await navigator.clipboard.writeText(allText);
      message.success("已复制到剪贴板");
    } catch {
      message.error("复制失败");
    }
  };

  return (
    <>
      {/* 半透明遮罩 */}
      <div
        style={{
          background: "rgba(0,0,0,0.45)",
          boxSizing: "border-box",
          height: selH,
          left: canvasOffsetX,
          position: "absolute",
          top: 0,
          width: selW,
          zIndex: 26,
        }}
      />

      {/* 每个文字块按原始位置叠加显示 */}
      {!loading &&
        blocks &&
        blocks.map((block, idx) => {
          const px = canvasOffsetX + block.x * selW;
          const py = block.y * selH;
          const pw = block.w * selW;
          const ph = block.h * selH;
          const autoFontSize = Math.max(10, Math.min(24, ph * 0.75));
          return (
            <div
              className="ocr-text-block"
              // biome-ignore lint/suspicious/noArrayIndexKey: OCR blocks have no stable unique id
              key={idx}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              style={{
                background: "rgba(255,255,200,0.92)",
                borderRadius: 2,
                boxSizing: "border-box",
                color: "#111",
                cursor: "text",
                fontSize: autoFontSize,
                left: px,
                lineHeight: 1.2,
                maxWidth: pw + 8,
                minWidth: pw,
                overflow: "visible",
                padding: "1px 3px",
                position: "absolute",
                top: py,
                userSelect: "text",
                WebkitUserSelect: "text",
                whiteSpace: "nowrap",
                zIndex: 27,
              }}
              title={block.text}
            >
              {block.text}
            </div>
          );
        })}

      {/* OCR 顶部操作栏 */}
      <div
        style={{
          alignItems: "center",
          background: "rgba(20,20,20,0.88)",
          borderRadius: "0 0 6px 6px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "row",
          gap: 6,
          justifyContent: "space-between",
          left: canvasOffsetX,
          padding: "5px 10px",
          position: "absolute",
          top: 0,
          width: selW,
          zIndex: 29,
        }}
      >
        <div
          style={{
            alignItems: "center",
            color: "rgba(255,255,255,0.75)",
            display: "flex",
            fontSize: 12,
            gap: 5,
          }}
        >
          <UnoIcon name="i-lucide:scan-text" size={13} />
          {loading ? (
            <span style={{ color: "rgba(255,255,255,0.5)" }}>识别中…</span>
          ) : error ? (
            <span style={{ color: "#f87171" }}>{error}</span>
          ) : (
            <span>{blocks?.length ?? 0} 个文字块（可选中复制）</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {!loading && blocks && blocks.length > 0 && (
            <button
              onClick={handleCopyAll}
              style={{
                alignItems: "center",
                background: "rgba(59,130,246,0.7)",
                border: "1px solid rgba(59,130,246,0.9)",
                borderRadius: 4,
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                fontSize: 11,
                gap: 3,
                padding: "2px 7px",
              }}
              title="复制全部文字"
              type="button"
            >
              <UnoIcon name="i-lucide:copy" size={11} />
              复制全部
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              alignItems: "center",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 4,
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              display: "flex",
              padding: "2px 5px",
            }}
            title="关闭 (Esc)"
            type="button"
          >
            <UnoIcon name="i-lucide:x" size={12} />
          </button>
        </div>
      </div>
    </>
  );
};

export default OcrOverlay;
