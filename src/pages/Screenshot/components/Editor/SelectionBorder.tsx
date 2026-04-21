import { getHandleCursor } from "./drawUtils";
import type { HandleType, Selection } from "./types";

// 控制点尺寸
const HANDLE_SIZE = 8;

interface SelectionBorderProps {
  currentSel: Selection;
  canvasOffsetX: number;
  pinned: boolean;
  onHandleMouseDown: (e: React.MouseEvent, key: HandleType) => void;
  /**
   * 移动模式下边框的屏幕绝对位置（fixed 定位基准）。
   * 非移动模式下为 null，此时使用相对于 Editor 容器的 absolute 定位。
   */
  fixedOrigin?: { x: number; y: number } | null;
}

const SelectionBorder: React.FC<SelectionBorderProps> = ({
  currentSel,
  canvasOffsetX,
  pinned,
  onHandleMouseDown,
  fixedOrigin,
}) => {
  // 移动模式：用 fixed + 屏幕绝对坐标；否则用 absolute + 相对容器坐标
  const useFixed = Boolean(fixedOrigin);
  const originX = fixedOrigin ? fixedOrigin.x : 0;
  const originY = fixedOrigin ? fixedOrigin.y : 0;

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
          left: useFixed ? originX + canvasOffsetX : canvasOffsetX,
          pointerEvents: "none",
          position: useFixed ? "fixed" : "absolute",
          top: useFixed ? originY : 0,
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
              left: useFixed
                ? originX + x - (HANDLE_SIZE + 4) / 2
                : x - (HANDLE_SIZE + 4) / 2,
              position: useFixed ? "fixed" : "absolute",
              top: useFixed
                ? originY + y - (HANDLE_SIZE + 4) / 2
                : y - (HANDLE_SIZE + 4) / 2,
              width: HANDLE_SIZE + 4,
              zIndex: 22,
            }}
          />
        ))}
    </>
  );
};

export default SelectionBorder;
