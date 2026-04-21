import { useEffect, useRef, useState } from "react";
import type { HandleType, Selection } from "./types";

interface UseSelectionOptions {
  selection: Selection;
  /**
   * move/resize 拖拽结束后回调（统一入口）
   * 父组件负责同时更新 selection + bgImage（前端 canvas 裁剪），避免尺寸/内容不匹配
   */
  onSelectionChange?: (sel: Selection) => void;
  /** 拖拽过程中实时回调（move/resize 共用），仅用于更新 SVG 遮罩挖空位置 */
  onDragging?: (sel: Selection) => void;
}

export function useSelection({
  selection,
  onSelectionChange,
  onDragging,
}: UseSelectionOptions) {
  const [currentSel, setCurrentSel] = useState<Selection>(selection);
  const currentSelRef = useRef<Selection>(selection);

  // 控制点拖拽状态
  const activeHandle = useRef<HandleType | null>(null);
  const handleDragStart = useRef({ x: 0, y: 0 });
  const handleSelStart = useRef<Selection>({ h: 0, w: 0, x: 0, y: 0 });
  // ref 版本：同步读取，避免 React state 异步更新导致的一帧拉伸
  const isResizingRef = useRef(false);
  // React state 版本的 resize 状态，用于触发重渲染（固定 canvas 尺寸避免拉伸）
  const [isDraggingResize, setIsDraggingResize] = useState(false);

  // 移动拖拽状态
  const isMoving = useRef(false);
  // React state 版本的移动状态，用于触发重渲染（隐藏 canvas 避免残留）
  const [isDraggingMove, setIsDraggingMove] = useState(false);
  const moveDragStart = useRef({ x: 0, y: 0 });
  const moveSelStart = useRef<Selection>({ h: 0, w: 0, x: 0, y: 0 });

  // 等待图像更新状态：mouseup 后设为 true，bgImage 更新后设为 false
  const [pendingImageUpdate, setPendingImageUpdate] = useState(false);

  // 同步 selection prop 变化（仅在非拖拽状态下同步，避免打断拖拽）
  useEffect(() => {
    if (!activeHandle.current && !isMoving.current) {
      setCurrentSel(selection);
    }
  }, [selection]);

  // 用 ref 跟踪最新 currentSel，供全局 mouseup 读取
  useEffect(() => {
    currentSelRef.current = currentSel;
  }, [currentSel]);

  // 控制点拖拽 + 移动：全局 mousemove / mouseup
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // ── 移动逻辑 ──
      if (isMoving.current) {
        const dx = e.clientX - moveDragStart.current.x;
        const dy = e.clientY - moveDragStart.current.y;
        const newSel = {
          h: moveSelStart.current.h,
          w: moveSelStart.current.w,
          x: moveSelStart.current.x + dx,
          y: moveSelStart.current.y + dy,
        };
        setCurrentSel(newSel);
        // 实时通知框位置变化（仅更新 SVG 遮罩挖空位置）
        onDragging?.(newSel);
        return;
      }

      // ── 控制点缩放逻辑 ──
      if (!activeHandle.current) return;
      const { x: sx, y: sy, w: sw, h: sh } = handleSelStart.current;
      // 选区的固定边（对边）坐标
      const right = sx + sw; // 右边固定坐标
      const bottom = sy + sh; // 下边固定坐标
      const px = e.clientX;
      const py = e.clientY;

      let nx = sx,
        ny = sy,
        nw = sw,
        nh = sh;

      switch (activeHandle.current) {
        case "nw":
          // 左上角移动，右下角固定
          nx = Math.min(right - 1, px);
          ny = Math.min(bottom - 1, py);
          nw = right - nx;
          nh = bottom - ny;
          break;
        case "n":
          // 上边移动，下边固定
          ny = Math.min(bottom - 1, py);
          nh = bottom - ny;
          break;
        case "ne":
          // 右上角移动，左下角固定
          ny = Math.min(bottom - 1, py);
          nh = bottom - ny;
          nw = Math.max(1, px - sx);
          break;
        case "w":
          // 左边移动，右边固定
          nx = Math.min(right - 1, px);
          nw = right - nx;
          break;
        case "e":
          // 右边移动，左边固定
          nw = Math.max(1, px - sx);
          break;
        case "sw":
          // 左下角移动，右上角固定
          nx = Math.min(right - 1, px);
          nw = right - nx;
          nh = Math.max(1, py - sy);
          break;
        case "s":
          // 下边移动，上边固定
          nh = Math.max(1, py - sy);
          break;
        case "se":
          // 右下角移动，左上角固定
          nw = Math.max(1, px - sx);
          nh = Math.max(1, py - sy);
          break;
      }

      nw = Math.max(10, nw);
      nh = Math.max(10, nh);

      const newSel = { h: nh, w: nw, x: nx, y: ny };
      setCurrentSel(newSel);
      // 实时通知选区变化（仅更新 SVG 遮罩挖空位置）
      onDragging?.(newSel);
    };

    const onMouseUp = () => {
      if (isMoving.current) {
        isMoving.current = false;
        setIsDraggingMove(false);
        // move/resize 统一回调，父组件同时更新 selection + bgImage（前端 canvas 裁剪）
        setPendingImageUpdate(true);
        onSelectionChange?.(currentSelRef.current);
        return;
      }
      if (!activeHandle.current) return;
      activeHandle.current = null;
      isResizingRef.current = false;
      setIsDraggingResize(false);
      // move/resize 统一回调，父组件同时更新 selection + bgImage（前端 canvas 裁剪）
      setPendingImageUpdate(true);
      onSelectionChange?.(currentSelRef.current);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onSelectionChange, onDragging]);

  const startHandleDrag = (e: React.MouseEvent, key: HandleType) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    activeHandle.current = key;
    handleDragStart.current = { x: e.clientX, y: e.clientY };
    handleSelStart.current = { ...currentSel };
    isResizingRef.current = true;
    setIsDraggingResize(true);
  };

  const startMoveDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMoving.current = true;
    setIsDraggingMove(true);
    moveDragStart.current = { x: e.clientX, y: e.clientY };
    moveSelStart.current = { ...currentSel };
  };

  return {
    activeHandle,
    currentSel,
    currentSelRef,
    isDraggingMove,
    isDraggingResize,
    isMoving,
    isResizingRef,
    pendingImageUpdate,
    setPendingImageUpdate,
    startHandleDrag,
    startMoveDrag,
  };
}
