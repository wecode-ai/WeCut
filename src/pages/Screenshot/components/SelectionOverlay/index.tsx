import { useEffect, useRef } from "react";

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SelectionOverlayProps {
  bgImage: string;
  onConfirm: (sel: Selection) => void;
  onCancel: () => void;
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  bgImage,
  onConfirm,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentSel = useRef<Selection>({ h: 0, w: 0, x: 0, y: 0 });
  const bgImageEl = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // Load bg image once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      bgImageEl.current = img;
      drawFrame();
    };
    img.src = bgImage;

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [bgImage]);

  const getCanvas = (): HTMLCanvasElement | null => canvasRef.current;
  const getCtx = (): CanvasRenderingContext2D | null =>
    getCanvas()?.getContext("2d") ?? null;

  const drawFrame = () => {
    const canvas = getCanvas();
    const ctx = getCtx();
    if (!canvas || !ctx || !bgImageEl.current) return;

    const { width, height } = canvas;
    const { h, w, x, y } = currentSel.current;
    // bgImage 是物理像素截图，canvas 是逻辑像素尺寸，需要乘以 dpr 从物理图中取正确区域
    const dpr = window.devicePixelRatio || 1;

    // Draw background (物理像素图缩放到逻辑像素 canvas)
    ctx.drawImage(
      bgImageEl.current,
      0,
      0,
      bgImageEl.current.naturalWidth,
      bgImageEl.current.naturalHeight,
      0,
      0,
      width,
      height,
    );

    // Dark overlay over entire canvas
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, width, height);

    if (w > 0 && h > 0) {
      // Clear (reveal) the selection rectangle
      ctx.clearRect(x, y, w, h);

      // Re-draw just the background in the selection (从物理像素图中取对应区域)
      ctx.drawImage(
        bgImageEl.current,
        x * dpr,
        y * dpr,
        w * dpr,
        h * dpr,
        x,
        y,
        w,
        h,
      );

      // Draw selection border
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      // Draw corner handles
      const handleSize = 6;
      ctx.fillStyle = "#ffffff";
      const corners = [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
        [x + w / 2, y],
        [x + w / 2, y + h],
        [x, y + h / 2],
        [x + w, y + h / 2],
      ];
      for (const [cx, cy] of corners) {
        ctx.fillRect(
          cx - handleSize / 2,
          cy - handleSize / 2,
          handleSize,
          handleSize,
        );
      }

      // Draw size tooltip
      const label = `${Math.round(Math.abs(w))} × ${Math.round(Math.abs(h))}`;
      ctx.font = "bold 13px system-ui, sans-serif";
      const metrics = ctx.measureText(label);
      const padding = 6;
      const tooltipW = metrics.width + padding * 2;
      const tooltipH = 24;

      let tooltipX = x + w + 8;
      let tooltipY = y + h + 8;

      if (tooltipX + tooltipW > width) {
        tooltipX = x - tooltipW - 8;
      }
      if (tooltipY + tooltipH > height) {
        tooltipY = y - tooltipH - 8;
      }
      if (tooltipX < 0) tooltipX = 4;
      if (tooltipY < 0) tooltipY = 4;

      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 4);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, tooltipX + padding, tooltipY + tooltipH - 7);
    }
  };

  const getCanvasPos = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = getCanvas();
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pos = getCanvasPos(e);
    isDragging.current = true;
    startPos.current = pos;
    currentSel.current = { h: 0, w: 0, x: pos.x, y: pos.y };
    drawFrame();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const pos = getCanvasPos(e);
    const sx = startPos.current.x;
    const sy = startPos.current.y;
    currentSel.current = {
      h: pos.y - sy,
      w: pos.x - sx,
      x: sx,
      y: sy,
    };
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const { h, w, x, y } = currentSel.current;
    const normSel = normalizeSelection(x, y, w, h);
    if (normSel.w > 10 && normSel.h > 10) {
      onConfirm(normSel);
    }
  };

  const handleDoubleClick = () => {
    const { h, w, x, y } = currentSel.current;
    const normSel = normalizeSelection(x, y, w, h);
    if (normSel.w > 10 && normSel.h > 10) {
      onConfirm(normSel);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter") {
      const { h, w, x, y } = currentSel.current;
      const normSel = normalizeSelection(x, y, w, h);
      if (normSel.w > 10 && normSel.h > 10) {
        onConfirm(normSel);
      }
    }
  };

  // Resize canvas to fill window
  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Auto-focus the canvas so it receives keyboard events
  useEffect(() => {
    canvasRef.current?.focus();
  }, []);

  return (
    <canvas
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      ref={canvasRef}
      style={{
        cursor: "crosshair",
        display: "block",
        height: "100%",
        left: 0,
        outline: "none",
        position: "fixed",
        top: 0,
        width: "100%",
        zIndex: 10,
      }}
      tabIndex={0}
    />
  );
};

export default SelectionOverlay;

/** Normalize a selection so x/y is always top-left and w/h are positive */
function normalizeSelection(
  x: number,
  y: number,
  w: number,
  h: number,
): Selection {
  return {
    h: Math.abs(h),
    w: Math.abs(w),
    x: w < 0 ? x + w : x,
    y: h < 0 ? y + h : y,
  };
}
