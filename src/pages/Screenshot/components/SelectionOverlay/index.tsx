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

// 8 个控制点的类型
type HandleType = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se" | null;

// 控制点大小和命中区域
const HANDLE_SIZE = 8;
const HANDLE_HIT = 10; // 命中区域半径

/** 获取 8 个控制点的坐标 */
function getHandles(x: number, y: number, w: number, h: number) {
  return {
    e: { x: x + w, y: y + h / 2 },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    nw: { x, y },
    s: { x: x + w / 2, y: y + h },
    se: { x: x + w, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
  };
}

/** 根据控制点类型返回对应的 CSS cursor */
function getHandleCursor(handle: HandleType): string {
  switch (handle) {
    case "nw":
      return "nw-resize";
    case "n":
      return "n-resize";
    case "ne":
      return "ne-resize";
    case "w":
      return "w-resize";
    case "e":
      return "e-resize";
    case "sw":
      return "sw-resize";
    case "s":
      return "s-resize";
    case "se":
      return "se-resize";
    default:
      return "crosshair";
  }
}

/** 命中测试：返回鼠标命中的控制点类型，或 null */
function hitTestHandle(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
): HandleType {
  if (w <= 0 || h <= 0) return null;
  const handles = getHandles(x, y, w, h);
  for (const [key, pos] of Object.entries(handles) as [
    HandleType,
    { x: number; y: number },
  ][]) {
    const dx = px - pos.x;
    const dy = py - pos.y;
    if (Math.sqrt(dx * dx + dy * dy) <= HANDLE_HIT) {
      return key;
    }
  }
  return null;
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  bgImage,
  onConfirm,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const isMoving = useRef(false);
  // 正在拖拽的控制点
  const activeHandle = useRef<HandleType>(null);
  // 拖拽控制点时记录起始鼠标位置和起始选区
  const handleDragStart = useRef({ x: 0, y: 0 });
  const handleSelStart = useRef<Selection>({ h: 0, w: 0, x: 0, y: 0 });

  const startPos = useRef({ x: 0, y: 0 });
  const moveOffset = useRef({ x: 0, y: 0 });
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

      // Draw 8 handle points
      const handles = getHandles(x, y, w, h);
      for (const pos of Object.values(handles)) {
        // 外圈白色填充
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        // 内圈蓝色填充
        ctx.fillStyle = "#1677ff";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, HANDLE_SIZE / 2 - 1.5, 0, Math.PI * 2);
        ctx.fill();
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

  /** 判断点是否在当前选区内 */
  const isInsideSel = (px: number, py: number): boolean => {
    const { h, w, x, y } = currentSel.current;
    if (w <= 0 || h <= 0) return false;
    return px >= x && px <= x + w && py >= y && py <= y + h;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pos = getCanvasPos(e);
    const { h, w, x, y } = currentSel.current;

    // 优先检测是否命中控制点
    if (w > 0 && h > 0) {
      const hit = hitTestHandle(pos.x, pos.y, x, y, w, h);
      if (hit) {
        activeHandle.current = hit;
        handleDragStart.current = { x: pos.x, y: pos.y };
        handleSelStart.current = { ...currentSel.current };
        return;
      }
    }

    // Cmd + 鼠标在选区内 → 移动模式
    if (e.metaKey && isInsideSel(pos.x, pos.y)) {
      isMoving.current = true;
      moveOffset.current = {
        x: pos.x - currentSel.current.x,
        y: pos.y - currentSel.current.y,
      };
      return;
    }

    // 普通拖拽 → 重新选区
    isDragging.current = true;
    startPos.current = pos;
    currentSel.current = { h: 0, w: 0, x: pos.x, y: pos.y };
    drawFrame();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);

    // 拖拽控制点调整选区大小
    if (activeHandle.current) {
      const canvas = getCanvas();
      const cw = canvas?.width ?? 0;
      const ch = canvas?.height ?? 0;
      const { x: sx, y: sy, w: sw, h: sh } = handleSelStart.current;
      const dx = pos.x - handleDragStart.current.x;
      const dy = pos.y - handleDragStart.current.y;

      let nx = sx,
        ny = sy,
        nw = sw,
        nh = sh;

      switch (activeHandle.current) {
        case "nw":
          nx = Math.min(sx + sw - 1, sx + dx);
          ny = Math.min(sy + sh - 1, sy + dy);
          nw = sw - (nx - sx);
          nh = sh - (ny - sy);
          break;
        case "n":
          ny = Math.min(sy + sh - 1, sy + dy);
          nh = sh - (ny - sy);
          break;
        case "ne":
          ny = Math.min(sy + sh - 1, sy + dy);
          nh = sh - (ny - sy);
          nw = Math.max(1, sw + dx);
          break;
        case "w":
          nx = Math.min(sx + sw - 1, sx + dx);
          nw = sw - (nx - sx);
          break;
        case "e":
          nw = Math.max(1, sw + dx);
          break;
        case "sw":
          nx = Math.min(sx + sw - 1, sx + dx);
          nw = sw - (nx - sx);
          nh = Math.max(1, sh + dy);
          break;
        case "s":
          nh = Math.max(1, sh + dy);
          break;
        case "se":
          nw = Math.max(1, sw + dx);
          nh = Math.max(1, sh + dy);
          break;
      }

      // 边界限制
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      if (nx + nw > cw) nw = cw - nx;
      if (ny + nh > ch) nh = ch - ny;

      currentSel.current = { h: nh, w: nw, x: nx, y: ny };
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    // 移动选区
    if (isMoving.current) {
      const canvas = getCanvas();
      const { h, w } = currentSel.current;
      const newX = Math.max(
        0,
        Math.min(pos.x - moveOffset.current.x, (canvas?.width ?? 0) - w),
      );
      const newY = Math.max(
        0,
        Math.min(pos.y - moveOffset.current.y, (canvas?.height ?? 0) - h),
      );
      currentSel.current = { h, w, x: newX, y: newY };
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    if (!isDragging.current) return;
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
    // 控制点拖拽结束
    if (activeHandle.current) {
      activeHandle.current = null;
      // 不触发 confirm，保持选区让用户继续操作
      return;
    }

    if (isMoving.current) {
      isMoving.current = false;
      return;
    }

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

  const getCursor = (e: React.MouseEvent<HTMLCanvasElement>): string => {
    if (activeHandle.current) return getHandleCursor(activeHandle.current);
    if (isMoving.current) return "grabbing";
    const pos = getCanvasPos(e);
    const { h, w, x, y } = currentSel.current;

    // 检测是否悬停在控制点上
    if (w > 0 && h > 0) {
      const hit = hitTestHandle(pos.x, pos.y, x, y, w, h);
      if (hit) return getHandleCursor(hit);
    }

    if (e.metaKey && isInsideSel(pos.x, pos.y)) return "grab";
    return "crosshair";
  };

  return (
    <canvas
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => {
        handleMouseMove(e);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = getCursor(e);
        }
      }}
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
