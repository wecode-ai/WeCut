import { getHandleCursor } from "./drawUtils";
import type { HandleType, Selection } from "./types";

// 控制点尺寸
const HANDLE_SIZE = 8;

interface SelectionBorderProps {
  currentSel: Selection;
  canvasOffsetX: number;
  pinned: boolean;
  onHandleMouseDown: (e: React.MouseEvent, key: HandleType) => void;
}

const SelectionBorder: React.FC<SelectionBorderProps> = ({
  currentSel,
  canvasOffsetX,
  pinned,
  onHandleMouseDown,
}) => {
  const handles: { key: HandleType; x: number; y: number }[] = [
    { key: "nw", x: canvasOffsetX + 0, y: 0 },
    { key: "n", x: canvasOffsetX + currentSel.w / 2, y: 0 },
    { key: "ne", x: canvasOffsetX + currentSel.w, y: 0 },
    { key: "w", x: canvasOffsetX + 0, y: currentSel.h / 2 },
    { key: "e", x: canvasOffsetX + currentSel.w, y: currentSel.h / 2 },
    { key: "sw", x: canvasOffsetX + 0, y: currentSel.h },
    { key: "s", x: canvasOffsetX + currentSel.w / 2, y: currentSel.h },
    { key: "se", x: canvasOffsetX + currentSel.w, y: currentSel.h },
  ];

  return (
    <>
      {/* Selection border */}
      <div
        style={{
          border: "1.5px solid rgba(255,255,255,0.9)",
          boxShadow:
            "0 0 0 1.5px rgba(0,0,0,0.5), 0 4px 24px rgba(0,0,0,0.6), inset 0 0 12px rgba(0,0,0,0.25)",
          boxSizing: "border-box",
          height: currentSel.h,
          left: canvasOffsetX,
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          width: currentSel.w,
          zIndex: 21,
        }}
      />

      {/* 8 个可拖拽控制点（非 pin 模式下显示） */}
      {!pinned &&
        handles.map(({ key, x, y }) => (
          <div
            key={key}
            onMouseDown={(e) => onHandleMouseDown(e, key)}
            style={{
              background: "#ffffff",
              border: "1.5px solid #1677ff",
              borderRadius: "50%",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
              boxSizing: "border-box",
              cursor: getHandleCursor(key),
              height: HANDLE_SIZE + 4,
              left: x - (HANDLE_SIZE + 4) / 2,
              position: "absolute",
              top: y - (HANDLE_SIZE + 4) / 2,
              width: HANDLE_SIZE + 4,
              zIndex: 22,
            }}
          />
        ))}
    </>
  );
};

export default SelectionBorder;
