import UnoIcon from "@/components/UnoIcon";

export type DrawTool =
  | "rect"
  | "ellipse"
  | "arrow"
  | "text"
  | "pen"
  | "mosaic";

interface ToolbarProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  lineWidth: number;
  onLineWidthChange: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: { key: DrawTool; icon: string; title: string }[] = [
  { icon: "i-lucide:square", key: "rect", title: "Rectangle" },
  { icon: "i-lucide:circle", key: "ellipse", title: "Ellipse" },
  { icon: "i-lucide:move-up-right", key: "arrow", title: "Arrow" },
  { icon: "i-lucide:type", key: "text", title: "Text" },
  { icon: "i-lucide:pen", key: "pen", title: "Pen" },
  { icon: "i-lucide:grid-3x3", key: "mosaic", title: "Mosaic" },
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

const LINE_WIDTHS: { label: string; value: number }[] = [
  { label: "S", value: 2 },
  { label: "M", value: 4 },
  { label: "L", value: 8 },
];

const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  lineWidth,
  onLineWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  return (
    <div
      style={{
        alignItems: "center",
        background: "rgba(30,30,30,0.92)",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "row",
        gap: 6,
        padding: "8px 12px",
        userSelect: "none",
      }}
    >
      {/* Tool buttons */}
      <div style={{ display: "flex", flexDirection: "row", gap: 2 }}>
        {TOOLS.map(({ icon, key, title }) => (
          <button
            key={key}
            onClick={() => onToolChange(key)}
            style={{
              alignItems: "center",
              background: activeTool === key ? "rgba(255,255,255,0.18)" : "transparent",
              border: activeTool === key ? "1.5px solid rgba(255,255,255,0.45)" : "1.5px solid transparent",
              borderRadius: 7,
              color: activeTool === key ? "#ffffff" : "rgba(255,255,255,0.7)",
              cursor: "pointer",
              display: "flex",
              height: 34,
              justifyContent: "center",
              padding: "0 6px",
              transition: "all 0.15s",
              width: 34,
            }}
            title={title}
            type="button"
          >
            <UnoIcon name={icon} size={16} />
          </button>
        ))}
      </div>

      <div style={{ background: "rgba(255,255,255,0.15)", height: 28, margin: "0 4px", width: 1 }} />

      {/* Color swatches */}
      <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            style={{
              background: color,
              border: activeColor === color
                ? "2.5px solid rgba(255,255,255,0.9)"
                : "2px solid rgba(255,255,255,0.25)",
              borderRadius: "50%",
              cursor: "pointer",
              height: 18,
              padding: 0,
              width: 18,
            }}
            title={color}
            type="button"
          />
        ))}
      </div>

      <div style={{ background: "rgba(255,255,255,0.15)", height: 28, margin: "0 4px", width: 1 }} />

      {/* Line width */}
      <div style={{ alignItems: "center", display: "flex", flexDirection: "row", gap: 4 }}>
        {LINE_WIDTHS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onLineWidthChange(value)}
            style={{
              alignItems: "center",
              background: lineWidth === value ? "rgba(255,255,255,0.18)" : "transparent",
              border: lineWidth === value ? "1.5px solid rgba(255,255,255,0.45)" : "1.5px solid transparent",
              borderRadius: 6,
              color: lineWidth === value ? "#ffffff" : "rgba(255,255,255,0.65)",
              cursor: "pointer",
              display: "flex",
              fontSize: 12,
              fontWeight: 600,
              height: 28,
              justifyContent: "center",
              padding: "0 8px",
            }}
            title={`Line width ${value}px`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ background: "rgba(255,255,255,0.15)", height: 28, margin: "0 4px", width: 1 }} />

      {/* Undo / Redo */}
      <div style={{ display: "flex", flexDirection: "row", gap: 2 }}>
        <button
          disabled={!canUndo}
          onClick={onUndo}
          style={{
            alignItems: "center",
            background: "transparent",
            border: "1.5px solid transparent",
            borderRadius: 7,
            color: canUndo ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)",
            cursor: canUndo ? "pointer" : "default",
            display: "flex",
            height: 34,
            justifyContent: "center",
            width: 34,
          }}
          title="Undo (Cmd+Z)"
          type="button"
        >
          <UnoIcon name="i-lucide:undo-2" size={16} />
        </button>
        <button
          disabled={!canRedo}
          onClick={onRedo}
          style={{
            alignItems: "center",
            background: "transparent",
            border: "1.5px solid transparent",
            borderRadius: 7,
            color: canRedo ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)",
            cursor: canRedo ? "pointer" : "default",
            display: "flex",
            height: 34,
            justifyContent: "center",
            width: 34,
          }}
          title="Redo (Cmd+Shift+Z)"
          type="button"
        >
          <UnoIcon name="i-lucide:redo-2" size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
