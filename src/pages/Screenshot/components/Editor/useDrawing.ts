import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawTool } from "../Toolbar";
import { drawShape, hitTestShape, moveShape } from "./drawUtils";
import type { Selection, Shape, TextShape } from "./types";

interface UseDrawingOptions {
  selection: Selection;
  bgCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeColor: string;
  lineWidth: number;
  fontSize: number;
  activeTool: DrawTool;
  /** bgImage 已经是裁剪好的选区图片，不需要再用 selection.x/y 偏移裁剪 */
  bgImageCropped?: boolean;
}

export function useDrawing({
  selection,
  bgCanvasRef,
  canvasRef,
  activeColor,
  lineWidth,
  fontSize,
  activeTool,
  bgImageCropped = false,
}: UseDrawingOptions) {
  const bgImageEl = useRef<HTMLImageElement | null>(null);
  const bgImageLoaded = useRef(false);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const shapesRef = useRef<Shape[]>([]);
  const historyIndexRef = useRef(-1);

  const isDrawing = useRef(false);
  const drawStart = useRef({ x: 0, y: 0 });
  const currentShape = useRef<Shape | null>(null);

  // Cmd+drag to move a single shape
  const isMovingShape = useRef(false);
  const movingShapeIndex = useRef(-1);
  const movingShapeDragStart = useRef({ x: 0, y: 0 });
  const movingShapeOriginal = useRef<Shape | null>(null);

  // Text input state
  const [textInputPos, setTextInputPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [textInputValue, setTextInputValue] = useState("");
  const isCommittingTextRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { h, w } = selection;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, w, h);

    if (bgImageEl.current) {
      if (bgImageCropped) {
        // 图片已经是裁剪好的选区，直接绘制整张图片到 canvas
        ctx.drawImage(bgImageEl.current, 0, 0, w, h);
      } else {
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
    }

    const committed = shapesRef.current.slice(0, historyIndexRef.current + 1);
    for (const shape of committed) {
      drawShape(ctx, shape, bgCanvasRef.current);
    }

    if (currentShape.current) {
      drawShape(ctx, currentShape.current, bgCanvasRef.current);
    }
  }, [selection, canvasRef, bgCanvasRef]);

  // Load background image
  // Load background image
  const loadBgImage = useCallback(
    (bgImage: string) => {
      const img = new Image();
      img.onload = () => {
        bgImageEl.current = img;
        bgImageLoaded.current = true;

        const dpr = window.devicePixelRatio || 1;
        const bgCanvas = bgCanvasRef.current;
        if (bgCanvas) {
          bgCanvas.width = selection.w;
          bgCanvas.height = selection.h;
          const ctx = bgCanvas.getContext("2d");
          if (ctx) {
            if (bgImageCropped) {
              // 图片已经是裁剪好的选区，直接绘制整张图片
              ctx.drawImage(img, 0, 0, selection.w, selection.h);
            } else {
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
        }

        redraw();
      };
      img.src = bgImage;
    },
    [selection, bgCanvasRef, redraw, bgImageCropped],
  );
  const commitShape = useCallback(
    (shape: Shape) => {
      const nextIndex = historyIndexRef.current + 1;
      const nextShapes = [...shapesRef.current.slice(0, nextIndex), shape];
      setShapes(nextShapes);
      setHistoryIndex(nextShapes.length - 1);
      shapesRef.current = nextShapes;
      historyIndexRef.current = nextShapes.length - 1;
      currentShape.current = null;
      redraw();
    },
    [redraw],
  );

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

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    if (activeTool === "text") {
      if (textInputPos) {
        isCommittingTextRef.current = true;
        if (textInputValue.trim()) {
          const shape: TextShape = {
            color: activeColor,
            fontSize,
            lineWidth,
            text: textInputValue.trim(),
            type: "text",
            x: textInputPos.x,
            y: textInputPos.y + fontSize,
          };
          commitShape(shape);
        }
        setTextInputPos(null);
        setTextInputValue("");
        isCommittingTextRef.current = false;
        return;
      }
      const pos = getPos(e);
      setTextInputPos(pos);
      setTextInputValue("");
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
    if (isMovingShape.current && movingShapeOriginal.current) {
      const dx = e.clientX - movingShapeDragStart.current.x;
      const dy = e.clientY - movingShapeDragStart.current.y;
      const movedShape = moveShape(movingShapeOriginal.current, dx, dy);
      const nextShapes = [...shapesRef.current];
      nextShapes[movingShapeIndex.current] = movedShape;
      shapesRef.current = nextShapes;
      requestAnimationFrame(redraw);
      return;
    }

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
    if (isMovingShape.current) {
      isMovingShape.current = false;
      movingShapeIndex.current = -1;
      movingShapeOriginal.current = null;
      const nextShapes = [...shapesRef.current];
      setShapes(nextShapes);
      requestAnimationFrame(redraw);
      return;
    }

    if (!isDrawing.current || !currentShape.current) return;
    isDrawing.current = false;
    commitShape(currentShape.current);
  };

  /** 处理 Cmd+drag 移动 shape，返回 true 表示已处理（调用方应 return） */
  const handleMetaMouseDown = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): boolean => {
    if (!e.metaKey) return false;
    const pos = getPos(e);
    const committed = shapesRef.current.slice(0, historyIndexRef.current + 1);
    const hitIdx = hitTestShape(pos.x, pos.y, committed);
    if (hitIdx >= 0) {
      isMovingShape.current = true;
      movingShapeIndex.current = hitIdx;
      movingShapeDragStart.current = { x: e.clientX, y: e.clientY };
      movingShapeOriginal.current = shapesRef.current[hitIdx];
      return true;
    }
    return false;
  };

  const handleTextConfirm = (
    textInputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (isCommittingTextRef.current) return;
    if (!textInputPos || !textInputValue.trim()) {
      setTextInputPos(null);
      return;
    }
    const shape: TextShape = {
      color: activeColor,
      fontSize,
      lineWidth,
      text: textInputValue.trim(),
      type: "text",
      x: textInputPos.x,
      y: textInputPos.y + fontSize,
    };
    commitShape(shape);
    setTextInputPos(null);
    setTextInputValue("");
    textInputRef.current?.focus();
  };

  const getHitTestResult = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    const committed = shapesRef.current.slice(0, historyIndexRef.current + 1);
    return hitTestShape(pos.x, pos.y, committed);
  };

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < shapes.length - 1;

  return {
    canRedo,
    canUndo,
    commitShape,
    getHitTestResult,
    getPos,
    handleMetaMouseDown,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTextConfirm,
    historyIndex,
    historyIndexRef,
    isCommittingTextRef,
    isDrawing,
    isMovingShape,
    // methods
    loadBgImage,
    redo,
    redraw,
    setTextInputPos,
    setTextInputValue,
    // state
    shapes,
    // refs
    shapesRef,
    textInputPos,
    textInputValue,
    undo,
  };
}
