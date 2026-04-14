import { message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import UnoIcon from "@/components/UnoIcon";
import {
  copyImageToClipboard,
  hideScreenshotWindow,
  saveScreenshotToFile,
} from "../../hooks/useScreenshot";
import Toolbar, { type DrawTool } from "../Toolbar";

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EditorProps {
  bgImage: string;
  selection: Selection;
  onClose: () => void;
  onSendToWegent?: (dataUrl: string) => void;
}

type ShapeType = DrawTool;

interface BaseShape {
  type: ShapeType;
  color: string;
  lineWidth: number;
}

interface RectShape extends BaseShape {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EllipseShape extends BaseShape {
  type: "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ArrowShape extends BaseShape {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface TextShape extends BaseShape {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

interface PenShape extends BaseShape {
  type: "pen";
  points: { x: number; y: number }[];
}

interface MosaicShape extends BaseShape {
  type: "mosaic";
  x: number;
  y: number;
  w: number;
  h: number;
}

type Shape =
  | RectShape
  | EllipseShape
  | ArrowShape
  | TextShape
  | PenShape
  | MosaicShape;

const Editor: React.FC<EditorProps> = ({
  bgImage,
  selection,
  onClose,
  onSendToWegent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const bgImageEl = useRef<HTMLImageElement | null>(null);
  const bgImageLoaded = useRef(false);

  const [activeTool, setActiveTool] = useState<DrawTool>("rect");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(2);

  // History: shapes up to historyIndex are committed
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const shapesRef = useRef<Shape[]>([]);
  const historyIndexRef = useRef(-1);

  // Current drawing shape
  const isDrawing = useRef(false);
  const drawStart = useRef({ x: 0, y: 0 });
  const currentShape = useRef<Shape | null>(null);

  // Text input state
  const [textInputPos, setTextInputPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [textInputValue, setTextInputValue] = useState("");

  // Keep refs in sync
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const _committedShapes = (): Shape[] => {
    return shapes.slice(0, historyIndex + 1);
  };

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      bgImageEl.current = img;
      bgImageLoaded.current = true;

      // bgImage 是物理像素截图，selection 是逻辑像素坐标，需要乘以 dpr 转换
      const dpr = window.devicePixelRatio || 1;

      // Draw on the bg canvas (for mosaic sampling)
      const bgCanvas = bgCanvasRef.current;
      if (bgCanvas) {
        bgCanvas.width = selection.w;
        bgCanvas.height = selection.h;
        const ctx = bgCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            img,
            selection.x * dpr,
            selection.y * dpr,
            selection.w * dpr,
            selection.h * dpr,
            0,
            0,
            selection.w,
            selection.h,
          );
        }
      }

      redraw();
    };
    img.src = bgImage;
  }, [bgImage, selection]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { h, w } = selection;
    // bgImage 是物理像素截图，selection 是逻辑像素坐标，需要乘以 dpr 转换
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, w, h);

    // Draw background crop
    if (bgImageEl.current) {
      ctx.drawImage(
        bgImageEl.current,
        selection.x * dpr,
        selection.y * dpr,
        w * dpr,
        h * dpr,
        0,
        0,
        w,
        h,
      );
    }

    // Draw committed shapes
    const committed = shapesRef.current.slice(0, historyIndexRef.current + 1);
    for (const shape of committed) {
      drawShape(ctx, shape);
    }

    // Draw current in-progress shape
    if (currentShape.current) {
      drawShape(ctx, currentShape.current);
    }
  }, [selection]);

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (shape.type) {
      case "rect": {
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
        break;
      }
      case "ellipse": {
        ctx.beginPath();
        ctx.ellipse(
          shape.x + shape.w / 2,
          shape.y + shape.h / 2,
          Math.abs(shape.w / 2),
          Math.abs(shape.h / 2),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        break;
      }
      case "arrow": {
        drawArrow(ctx, shape.x1, shape.y1, shape.x2, shape.y2, shape.lineWidth);
        break;
      }
      case "text": {
        ctx.font = `${shape.fontSize}px system-ui, sans-serif`;
        ctx.fillStyle = shape.color;
        ctx.fillText(shape.text, shape.x, shape.y);
        break;
      }
      case "pen": {
        if (shape.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
        break;
      }
      case "mosaic": {
        drawMosaic(ctx, shape);
        break;
      }
    }
    ctx.restore();
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    lw: number,
  ) => {
    const headLen = Math.max(12, lw * 4);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
  };

  const drawMosaic = (ctx: CanvasRenderingContext2D, shape: MosaicShape) => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    const blockSize = 8;
    const { h, w, x, y } = shape;
    const normX = w < 0 ? x + w : x;
    const normY = h < 0 ? y + h : y;
    const normW = Math.abs(w);
    const normH = Math.abs(h);

    for (let bx = normX; bx < normX + normW; bx += blockSize) {
      for (let by = normY; by < normY + normH; by += blockSize) {
        const sampleX = Math.min(bx, bgCanvas.width - 1);
        const sampleY = Math.min(by, bgCanvas.height - 1);
        const pixel = bgCtx.getImageData(sampleX, sampleY, 1, 1).data;
        ctx.fillStyle = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3] / 255})`;
        const bw = Math.min(blockSize, normX + normW - bx);
        const bh = Math.min(blockSize, normY + normH - by);
        ctx.fillRect(bx, by, bw, bh);
      }
    }
  };

  // Canvas coordinate from mouse event
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const commitShape = (shape: Shape) => {
    const nextIndex = historyIndexRef.current + 1;
    const nextShapes = [...shapesRef.current.slice(0, nextIndex), shape];
    setShapes(nextShapes);
    setHistoryIndex(nextShapes.length - 1);
    shapesRef.current = nextShapes;
    historyIndexRef.current = nextShapes.length - 1;
    currentShape.current = null;
    redraw();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    if (activeTool === "text") {
      const pos = getPos(e);
      setTextInputPos(pos);
      setTextInputValue("");
      setTimeout(() => textInputRef.current?.focus(), 10);
      return;
    }

    isDrawing.current = true;
    const pos = getPos(e);
    drawStart.current = pos;

    if (activeTool === "pen") {
      currentShape.current = {
        color: activeColor,
        lineWidth,
        points: [pos],
        type: "pen",
      };
    } else if (activeTool === "rect") {
      currentShape.current = {
        color: activeColor,
        h: 0,
        lineWidth,
        type: "rect",
        w: 0,
        x: pos.x,
        y: pos.y,
      };
    } else if (activeTool === "ellipse") {
      currentShape.current = {
        color: activeColor,
        h: 0,
        lineWidth,
        type: "ellipse",
        w: 0,
        x: pos.x,
        y: pos.y,
      };
    } else if (activeTool === "arrow") {
      currentShape.current = {
        color: activeColor,
        lineWidth,
        type: "arrow",
        x1: pos.x,
        x2: pos.x,
        y1: pos.y,
        y2: pos.y,
      };
    } else if (activeTool === "mosaic") {
      currentShape.current = {
        color: activeColor,
        h: 0,
        lineWidth,
        type: "mosaic",
        w: 0,
        x: pos.x,
        y: pos.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !currentShape.current) return;
    const pos = getPos(e);
    const shape = currentShape.current;

    if (shape.type === "pen") {
      shape.points.push(pos);
    } else if (
      shape.type === "rect" ||
      shape.type === "ellipse" ||
      shape.type === "mosaic"
    ) {
      shape.w = pos.x - drawStart.current.x;
      shape.h = pos.y - drawStart.current.y;
    } else if (shape.type === "arrow") {
      shape.x2 = pos.x;
      shape.y2 = pos.y;
    }

    requestAnimationFrame(redraw);
  };

  const handleMouseUp = () => {
    if (!isDrawing.current || !currentShape.current) return;
    isDrawing.current = false;
    commitShape(currentShape.current);
  };

  const handleTextConfirm = () => {
    if (!textInputPos || !textInputValue.trim()) {
      setTextInputPos(null);
      return;
    }
    const shape: TextShape = {
      color: activeColor,
      fontSize: 18,
      lineWidth,
      text: textInputValue.trim(),
      type: "text",
      x: textInputPos.x,
      y: textInputPos.y + 18,
    };
    commitShape(shape);
    setTextInputPos(null);
    setTextInputValue("");
    canvasRef.current?.focus();
  };

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return;
    const newIndex = historyIndexRef.current - 1;
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
    requestAnimationFrame(redraw);
  }, [redraw]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= shapesRef.current.length - 1) return;
    const newIndex = historyIndexRef.current + 1;
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
    requestAnimationFrame(redraw);
  }, [redraw]);

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      redo();
    } else if (isMeta && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Auto-focus canvas
  useEffect(() => {
    canvasRef.current?.focus();
  }, []);

  // Build final screenshot data URL
  const getFinalDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const handleCopy = async () => {
    try {
      const dataUrl = getFinalDataUrl();
      await copyImageToClipboard(dataUrl);
      message.success("Copied to clipboard");
      // Hide screenshot window after copy
      await hideScreenshotWindow();
    } catch (_err) {
      message.error("Failed to copy");
    }
  };

  const handleSave = async () => {
    try {
      const dataUrl = getFinalDataUrl();
      const path = await saveScreenshotToFile(dataUrl, "png");
      message.success(`Saved to ${path}`);
    } catch (err) {
      if (err instanceof Error && err.message !== "Save cancelled") {
        message.error("Failed to save");
      }
    }
  };

  const handleSendToWegent = () => {
    const dataUrl = getFinalDataUrl();
    onSendToWegent?.(dataUrl);
    onClose();
  };

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < shapes.length - 1;

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        left: selection.x,
        position: "fixed",
        top: selection.y,
        zIndex: 20,
      }}
      tabIndex={-1}
    >
      {/* Canvas */}
      <canvas
        height={selection.h}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={canvasRef}
        style={{
          cursor: activeTool === "text" ? "text" : "crosshair",
          display: "block",
          outline: "none",
        }}
        tabIndex={0}
        width={selection.w}
      />

      {/* Hidden bg canvas for mosaic sampling */}
      <canvas ref={bgCanvasRef} style={{ display: "none" }} />

      {/* Selection border */}
      <div
        style={{
          border: "1.5px solid rgba(255,255,255,0.7)",
          boxSizing: "border-box",
          height: selection.h,
          left: 0,
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          width: selection.w,
          zIndex: 21,
        }}
      />

      {/* Text input overlay */}
      {textInputPos && (
        <input
          onBlur={handleTextConfirm}
          onChange={(e) => setTextInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleTextConfirm();
            if (e.key === "Escape") {
              setTextInputPos(null);
              setTextInputValue("");
            }
          }}
          ref={textInputRef}
          style={{
            background: "transparent",
            border: "none",
            caretColor: activeColor,
            color: activeColor,
            fontSize: 18,
            fontWeight: 500,
            left: textInputPos.x,
            minWidth: 60,
            outline: "1.5px dashed rgba(255,255,255,0.5)",
            padding: "2px 4px",
            position: "absolute",
            top: textInputPos.y,
            zIndex: 25,
          }}
          type="text"
          value={textInputValue}
        />
      )}

      {/* Toolbar */}
      <div
        style={{
          left: "50%",
          position: "absolute",
          top: selection.h + 10,
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <Toolbar
          activeColor={activeColor}
          activeTool={activeTool}
          canRedo={canRedo}
          canUndo={canUndo}
          lineWidth={lineWidth}
          onColorChange={setActiveColor}
          onLineWidthChange={setLineWidth}
          onRedo={redo}
          onToolChange={setActiveTool}
          onUndo={undo}
        />
      </div>

      {/* Action buttons */}
      <div
        style={{
          left: "50%",
          position: "absolute",
          top: selection.h + 62,
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(30,30,30,0.92)",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "row",
            gap: 6,
            padding: "6px 10px",
            whiteSpace: "nowrap",
          }}
        >
          <ActionButton icon="i-lucide:x" label="Cancel" onClick={onClose} />
          <ActionButton
            icon="i-lucide:clipboard-copy"
            label="Copy"
            onClick={handleCopy}
            primary
          />
          <ActionButton
            icon="i-lucide:save"
            label="Save"
            onClick={handleSave}
          />
          {onSendToWegent && (
            <ActionButton
              icon="i-lucide:send"
              label="Send to Wegent"
              onClick={handleSendToWegent}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface ActionButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  primary?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onClick,
  primary,
}) => (
  <button
    onClick={onClick}
    style={{
      alignItems: "center",
      background: primary ? "rgba(59,130,246,0.85)" : "rgba(255,255,255,0.08)",
      border: primary
        ? "1.5px solid rgba(59,130,246,0.9)"
        : "1.5px solid rgba(255,255,255,0.15)",
      borderRadius: 8,
      color: "#ffffff",
      cursor: "pointer",
      display: "flex",
      fontSize: 13,
      fontWeight: 500,
      gap: 5,
      padding: "5px 12px",
      transition: "background 0.15s",
    }}
    type="button"
  >
    <UnoIcon name={icon} size={14} />
    {label}
  </button>
);

export default Editor;
