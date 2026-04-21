import { useEffect, useRef } from "react";
import {
  getCanvasLogicalPoint,
  getCanvasLogicalSize,
  getCanvasPixelSize,
} from "@/utils/canvas-hidpi";
import {
  logPerf,
  SCREENSHOT_PERF_ACCEPTANCE_TARGETS,
  SCREENSHOT_PERF_METRICS,
} from "@/utils/perf-log";
import type { WindowInfo } from "../../hooks/useScreenshot";
import { getWindowList } from "../../hooks/useScreenshot";

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
  /** 当前显示器 ID，用于获取窗口列表 */
  monitorId?: number;
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

/** 找到包含指定点的最顶层窗口（窗口列表已按 z-order 从前到后排列） */
function findWindowAtPoint(
  px: number,
  py: number,
  windows: WindowInfo[],
): WindowInfo | null {
  for (const win of windows) {
    if (
      px >= win.x &&
      px <= win.x + win.width &&
      py >= win.y &&
      py <= win.y + win.height
    ) {
      return win;
    }
  }
  return null;
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  bgImage,
  onConfirm,
  onCancel,
  monitorId = 0,
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

  // 窗口列表（用于自动框选）
  const windowListRef = useRef<WindowInfo[]>([]);
  // 当前鼠标悬停的窗口（高亮显示）
  const hoveredWindowRef = useRef<WindowInfo | null>(null);
  // 是否已经开始拖拽（区分点击和拖拽）
  const hasDraggedRef = useRef(false);
  const imageLoadStartedAtRef = useRef(0);
  const imageLoadedAtRef = useRef(0);
  const firstFrameLoggedRef = useRef(false);

  // Load bg image once
  useEffect(() => {
    const img = new Image();
    imageLoadStartedAtRef.current = performance.now();
    firstFrameLoggedRef.current = false;
    img.onload = () => {
      imageLoadedAtRef.current = performance.now();
      logPerf("[screenshot][ui] overlay:bg_image_loaded", {
        elapsedMs: Math.round(
          imageLoadedAtRef.current - imageLoadStartedAtRef.current,
        ),
        naturalHeight: img.naturalHeight,
        naturalWidth: img.naturalWidth,
      });
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

  // 加载窗口列表
  useEffect(() => {
    getWindowList(monitorId)
      .then((list) => {
        windowListRef.current = list;
      })
      .catch(() => {
        windowListRef.current = [];
      });
  }, [monitorId]);

  const getCanvas = (): HTMLCanvasElement | null => canvasRef.current;
  const getCtx = (): CanvasRenderingContext2D | null =>
    getCanvas()?.getContext("2d") ?? null;
  const getDpr = () => window.devicePixelRatio || 1;
  const getCanvasLogicalBounds = () => {
    const canvas = getCanvas();
    if (!canvas) return { height: 0, width: 0 };
    return getCanvasLogicalSize(canvas.width, canvas.height, getDpr());
  };

  const drawFrame = () => {
    const canvas = getCanvas();
    const ctx = getCtx();
    if (!canvas || !ctx || !bgImageEl.current) return;

    const dpr = getDpr();
    const { height, width } = getCanvasLogicalBounds();
    const { h, w, x, y } = currentSel.current;

    // 保存当前变换矩阵
    ctx.save();

    // 清除整个 Canvas（使用物理像素坐标）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 设置 DPR 缩放，确保绘制使用逻辑坐标但映射到物理像素
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw background (物理像素图缩放到逻辑像素 canvas)
    // 确保绘制区域覆盖整个逻辑 Canvas 区域
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

    if (!firstFrameLoggedRef.current) {
      firstFrameLoggedRef.current = true;
      const now = performance.now();
      logPerf("[screenshot][ui] overlay:first_frame_drawn", {
        elapsedSinceImageLoadMs: Math.round(now - imageLoadedAtRef.current),
        metric: SCREENSHOT_PERF_METRICS.firstFrameDrawn,
        targetMs: SCREENSHOT_PERF_ACCEPTANCE_TARGETS.firstFrameAfterReadyMs,
      });
    }

    // Dark overlay over entire canvas
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, width, height);

    // 绘制悬停窗口高亮（仅在未开始选区时显示）
    const hovered = hoveredWindowRef.current;
    if (hovered && w === 0 && h === 0) {
      const { x: hx, y: hy, width: hw, height: hh } = hovered;

      // 清除（显示）悬停窗口区域
      ctx.clearRect(hx, hy, hw, hh);

      // 重绘该区域的背景图
      ctx.drawImage(
        bgImageEl.current,
        hx * dpr,
        hy * dpr,
        hw * dpr,
        hh * dpr,
        hx,
        hy,
        hw,
        hh,
      );

      // 绘制高亮边框（蓝色虚线）
      ctx.strokeStyle = "rgba(22, 119, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(hx + 1, hy + 1, hw - 2, hh - 2);
      ctx.setLineDash([]);

      // 绘制应用名称标签
      const label = hovered.app_name || hovered.title || "Window";
      ctx.font = "bold 13px system-ui, sans-serif";
      const metrics = ctx.measureText(label);
      const padding = 6;
      const tooltipW = metrics.width + padding * 2;
      const tooltipH = 24;
      let tooltipX = hx;
      let tooltipY = hy - tooltipH - 4;
      if (tooltipY < 0) tooltipY = hy + 4;
      if (tooltipX + tooltipW > width) tooltipX = width - tooltipW - 4;

      ctx.fillStyle = "rgba(22, 119, 255, 0.85)";
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 4);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, tooltipX + padding, tooltipY + tooltipH - 7);
    }

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

    // 恢复上下文
    ctx.restore();
  };

  const getCanvasPos = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = getCanvas();
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return getCanvasLogicalPoint(
      { x: e.clientX, y: e.clientY },
      {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      },
      { height: canvas.height, width: canvas.width },
      getDpr(),
    );
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
    hasDraggedRef.current = false;
    startPos.current = pos;
    currentSel.current = { h: 0, w: 0, x: pos.x, y: pos.y };
    // 开始拖拽时清除悬停高亮
    hoveredWindowRef.current = null;
    drawFrame();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);

    // 拖拽控制点调整选区大小
    // 拖拽控制点调整选区大小
    if (activeHandle.current) {
      const { height: ch, width: cw } = getCanvasLogicalBounds();
      const { x: sx, y: sy, w: sw, h: sh } = handleSelStart.current;
      // 选区的固定边（对边）坐标
      const right = sx + sw; // 右边固定坐标
      const bottom = sy + sh; // 下边固定坐标

      let nx = sx,
        ny = sy,
        nw = sw,
        nh = sh;

      switch (activeHandle.current) {
        case "nw":
          // 左上角移动，右下角固定
          nx = Math.min(right - 1, pos.x);
          ny = Math.min(bottom - 1, pos.y);
          nw = right - nx;
          nh = bottom - ny;
          break;
        case "n":
          // 上边移动，下边固定
          ny = Math.min(bottom - 1, pos.y);
          nh = bottom - ny;
          break;
        case "ne":
          // 右上角移动，左下角固定
          ny = Math.min(bottom - 1, pos.y);
          nh = bottom - ny;
          nw = Math.max(1, pos.x - sx);
          break;
        case "w":
          // 左边移动，右边固定
          nx = Math.min(right - 1, pos.x);
          nw = right - nx;
          break;
        case "e":
          // 右边移动，左边固定
          nw = Math.max(1, pos.x - sx);
          break;
        case "sw":
          // 左下角移动，右上角固定
          nx = Math.min(right - 1, pos.x);
          nw = right - nx;
          nh = Math.max(1, pos.y - sy);
          break;
        case "s":
          // 下边移动，上边固定
          nh = Math.max(1, pos.y - sy);
          break;
        case "se":
          // 右下角移动，左上角固定
          nw = Math.max(1, pos.x - sx);
          nh = Math.max(1, pos.y - sy);
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
      const { height: ch, width: cw } = getCanvasLogicalBounds();
      const { h, w } = currentSel.current;
      const newX = Math.max(0, Math.min(pos.x - moveOffset.current.x, cw - w));
      const newY = Math.max(0, Math.min(pos.y - moveOffset.current.y, ch - h));
      currentSel.current = { h, w, x: newX, y: newY };
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    if (isDragging.current) {
      // 标记已经发生了真实拖拽
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedRef.current = true;
      }

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
      return;
    }

    // 未拖拽时：更新悬停窗口高亮（仅在无选区时）
    const { w, h } = currentSel.current;
    if (w === 0 && h === 0) {
      const win = findWindowAtPoint(pos.x, pos.y, windowListRef.current);
      const prev = hoveredWindowRef.current;
      // 只有窗口变化时才重绘
      if (win !== prev) {
        hoveredWindowRef.current = win;
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(drawFrame);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

    // 如果没有发生真实拖拽（纯点击），则自动框选鼠标下方的窗口
    if (!hasDraggedRef.current) {
      const pos = getCanvasPos(e);
      const win = findWindowAtPoint(pos.x, pos.y, windowListRef.current);
      if (win) {
        const sel: Selection = {
          h: win.height,
          w: win.width,
          x: win.x,
          y: win.y,
        };
        currentSel.current = sel;
        hoveredWindowRef.current = null;
        drawFrame();
        onConfirm(sel);
        return;
      }
      // 点击空白区域：清空选区
      currentSel.current = { h: 0, w: 0, x: 0, y: 0 };
      drawFrame();
      return;
    }

    const { h, w, x, y } = currentSel.current;
    const normSel = normalizeSelection(x, y, w, h);
    // 将 currentSel 更新为规范化后的选区，确保控制点坐标与视觉位置一致
    currentSel.current = normSel;
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
      // 使用 window.innerWidth/Height 获取窗口大小
      // 注意：截图窗口应该全屏覆盖显示器
      const logicalWidth = window.innerWidth;
      const logicalHeight = window.innerHeight;
      const dpr = getDpr();
      const size = getCanvasPixelSize(logicalWidth, logicalHeight, dpr);

      // 确保 Canvas 实际像素大小和 CSS 显示大小一致
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
      canvas.width = size.width;
      canvas.height = size.height;

      logPerf("[screenshot][ui] canvas:resized", {
        dpr,
        logicalHeight,
        logicalWidth,
        pixelHeight: size.height,
        pixelWidth: size.width,
      });

      drawFrame();
    };

    // 延迟执行 resize，确保窗口大小已稳定
    const timer = setTimeout(resize, 0);
    window.addEventListener("resize", resize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
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
