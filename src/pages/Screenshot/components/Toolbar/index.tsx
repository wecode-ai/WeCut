import UnoIcon from "@/components/UnoIcon";

export type DrawTool = "rect" | "ellipse" | "arrow" | "text" | "pen" | "mosaic";

interface ToolbarProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  lineWidth: number;
  onLineWidthChange: (w: number) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClose?: () => void;
  onCopy?: () => void;
  onSave?: () => void;
  onPin?: () => void;
  onSendToWegent?: () => void;
  onOcr?: () => void;
  isPinned?: boolean;
  onCollapse?: () => void;
}

const TOOLS: { key: DrawTool; icon: string; title: string }[] = [
  { icon: "i-lucide:square", key: "rect", title: "矩形" },
  { icon: "i-lucide:circle", key: "ellipse", title: "椭圆" },
  { icon: "i-lucide:move-up-right", key: "arrow", title: "箭头" },
  { icon: "i-lucide:pen", key: "pen", title: "画笔" },
  { icon: "i-lucide:type", key: "text", title: "文字" },
  { icon: "i-lucide:grid-3x3", key: "mosaic", title: "马赛克" },
];

const COLOR_SWATCHES = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ffffff", // white
  "#000000", // black
];

// mosaic 工具不需要颜色/线宽
const TOOL_HAS_COLOR: Record<DrawTool, boolean> = {
  arrow: true,
  ellipse: true,
  mosaic: false,
  pen: true,
  rect: true,
  text: true,
};

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  lineWidth,
  onLineWidthChange,
  fontSize,
  onFontSizeChange,
  onUndo,
  onRedo: _onRedo,
  canUndo,
  canRedo: _canRedo,
  onClose,
  onCopy,
  onSave,
  onPin,
  onSendToWegent,
  onOcr,
  isPinned,
  onCollapse,
}) => {
  // 是否显示颜色/线宽子工具栏（选中绘图工具后显示）
  const showSubBar = TOOL_HAS_COLOR[activeTool];
  // 是否是文字工具（子工具栏显示字号而非线宽）
  const isTextTool = activeTool === "text";

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    alignItems: "center",
    background: active ? "rgba(255,255,255,0.18)" : "transparent",
    border: active
      ? "1.5px solid rgba(255,255,255,0.45)"
      : "1.5px solid transparent",
    borderRadius: 7,
    color: active ? "#ffffff" : "rgba(255,255,255,0.72)",
    cursor: "pointer",
    display: "flex",
    height: 32,
    justifyContent: "center",
    padding: "0 6px",
    transition: "all 0.13s",
    width: 32,
  });

  const divider = (
    <div
      style={{
        background: "rgba(255,255,255,0.15)",
        height: 20,
        margin: "0 3px",
        width: 1,
      }}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* ── 主工具栏 ── */}
      <div
        style={{
          alignItems: "center",
          background: "rgba(28,28,28,0.93)",
          borderRadius: 11,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "row",
          gap: 2,
          padding: "5px 10px",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {/* 撤销 */}
        <button
          disabled={!canUndo}
          onClick={onUndo}
          style={btnStyle()}
          title="撤销 (Cmd+Z)"
          type="button"
        >
          <UnoIcon
            name="i-lucide:undo-2"
            size={16}
            style={{
              color: canUndo
                ? "rgba(255,255,255,0.8)"
                : "rgba(255,255,255,0.25)",
            }}
          />
        </button>

        {divider}

        {/* 绘图工具 */}
        {/* 绘图工具 */}
        {TOOLS.map(({ icon, key, title }) => (
          <button
            key={key}
            onClick={() => onToolChange(key)}
            style={btnStyle(activeTool === key)}
            title={title}
            type="button"
          >
            <UnoIcon name={icon} size={16} />
          </button>
        ))}
        {divider}

        {/* 右侧操作按钮 */}
        {onSave && (
          <button
            onClick={onSave}
            style={btnStyle()}
            title="保存"
            type="button"
          >
            <UnoIcon name="i-lucide:download" size={16} />
          </button>
        )}
        {/* OCR 提取文字 */}
        {onOcr && (
          <button
            onClick={onOcr}
            style={btnStyle()}
            title="OCR 提取文字"
            type="button"
          >
            <UnoIcon name="i-lucide:scan-text" size={16} />
          </button>
        )}
        {!isPinned && onPin && (
          <button onClick={onPin} style={btnStyle()} title="钉住" type="button">
            <UnoIcon name="i-lucide:pin" size={16} />
          </button>
        )}
        {isPinned && onCollapse && (
          <button
            onClick={onCollapse}
            style={btnStyle()}
            title="收起"
            type="button"
          >
            <UnoIcon name="i-lucide:chevron-up" size={16} />
          </button>
        )}

        {divider}

        {/* 关闭（红叉） */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              ...btnStyle(),
              color: "rgba(255,90,90,0.9)",
            }}
            title="关闭 (Esc)"
            type="button"
          >
            <UnoIcon name="i-lucide:x" size={17} />
          </button>
        )}
        {/* 发送到 Wegent */}
        {onSendToWegent && (
          <button
            onClick={onSendToWegent}
            style={btnStyle()}
            title="发送到 Wegent"
            type="button"
          >
            <UnoIcon name="i-lucide:send" size={16} />
          </button>
        )}
        {/* 复制（蓝勾） */}
        {onCopy && (
          <button
            onClick={onCopy}
            style={{
              ...btnStyle(),
              background: "rgba(59,130,246,0.75)",
              border: "1.5px solid rgba(59,130,246,0.9)",
              color: "#ffffff",
            }}
            title="复制到剪贴板 (Enter)"
            type="button"
          >
            <UnoIcon name="i-lucide:check" size={17} />
          </button>
        )}
      </div>

      {/* ── 颜色 & 线宽/字号子工具栏（选中绘图工具后显示） ── */}
      {showSubBar && (
        <div
          style={{
            alignItems: "center",
            background: "rgba(28,28,28,0.93)",
            borderRadius: 9,
            boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "row",
            gap: 6,
            padding: "5px 12px",
            userSelect: "none",
          }}
        >
          {isTextTool ? (
            /* 字号选择区域 */
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "row",
                gap: 4,
              }}
            >
              <UnoIcon
                name="i-lucide:type"
                size={14}
                style={{ color: "rgba(255,255,255,0.5)", flexShrink: 0 }}
              />
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexDirection: "row",
                  gap: 2,
                }}
              >
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => onFontSizeChange(size)}
                    style={{
                      alignItems: "center",
                      background:
                        fontSize === size
                          ? "rgba(255,255,255,0.18)"
                          : "transparent",
                      border:
                        fontSize === size
                          ? "1.5px solid rgba(255,255,255,0.45)"
                          : "1.5px solid transparent",
                      borderRadius: 4,
                      color:
                        fontSize === size ? "#ffffff" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      display: "flex",
                      fontSize: 11,
                      height: 25,
                      justifyContent: "center",
                      minWidth: 25,
                      padding: "0 3px",
                      transition: "all 0.13s",
                    }}
                    title={`字号: ${size}px`}
                    type="button"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 线宽滑块区域 */
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "row",
                gap: 6,
              }}
            >
              {/* 细线图标 */}
              <span
                style={{
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: 1,
                  display: "inline-block",
                  height: 1.5,
                  width: 10,
                }}
              />
              <input
                className="screenshot-range"
                max={12}
                min={1}
                onChange={(e) => onLineWidthChange(Number(e.target.value))}
                style={{ "--track-h": `${lineWidth}px` } as React.CSSProperties}
                title={`线宽: ${lineWidth}px`}
                type="range"
                value={lineWidth}
              />
              {/* 粗线图标 */}
              <span
                style={{
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: 2,
                  display: "inline-block",
                  height: 4,
                  width: 14,
                }}
              />
            </div>
          )}

          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              height: 16,
              width: 1,
            }}
          />

          {/* 颜色色块 */}
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "row",
              gap: 4,
            }}
          >
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                style={{
                  background: color,
                  border:
                    activeColor === color
                      ? "2px solid rgba(255,255,255,0.95)"
                      : "1.5px solid rgba(255,255,255,0.22)",
                  borderRadius: "50%",
                  cursor: "pointer",
                  flexShrink: 0,
                  height: 18,
                  padding: 0,
                  transition: "transform 0.1s, border 0.1s",
                  width: 18,
                }}
                title={color}
                type="button"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
