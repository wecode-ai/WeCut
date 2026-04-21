import { useEffect, useRef, useState } from "react";
import type { HandleType, Selection } from "./types";

interface UseSelectionOptions {
  selection: Selection;
  onResize?: (sel: Selection) => void;
  onMove?: (sel: Selection) => void;
  /** 移动过程中实时回调（仅更新框位置，不触发重新裁剪） */
  onMoving?: (sel: Selection) => void;
}

export function useSelection({
  selection,
  onResize,
  onMove,
  onMoving,
}: UseSelectionOptions) {
  const [currentSel, setCurrentSel] = useState<Selection>(selection);
  const currentSelRef = useRef<Selection>(selection);

  // 控制点拖拽状态
  const activeHandle = useRef<HandleType | null>(null);
  const handleDragStart = useRef({ x: 0, y: 0 });
  const handleSelStart = useRef<Selection>({ h: 0, w: 0, x: 0, y: 0 });

  // 移动拖拽状态
  const isMoving = useRef(false);
  // React state 版本的移动状态，用于触发重渲染（区分 move 和 resize）
  const [isDraggingMove, setIsDraggingMove] = useState(false);
  const moveDragStart = useRef({ x: 0, y: 0 });
  const moveSelStart = useRef<Selection>({ h: 0, w: 0, x: 0, y: 0 });

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
        // 实时通知框位置变化（不触发重新裁剪）
        onMoving?.(newSel);
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

      setCurrentSel({ h: nh, w: nw, x: nx, y: ny });
    };

    const onMouseUp = () => {
      if (isMoving.current) {
        isMoving.current = false;
        setIsDraggingMove(false);
        onMove?.(currentSelRef.current);
        return;
      }
      if (!activeHandle.current) return;
      activeHandle.current = null;
      onResize?.(currentSelRef.current);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onResize, onMove, onMoving]);

  const startHandleDrag = (e: React.MouseEvent, key: HandleType) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    activeHandle.current = key;
    handleDragStart.current = { x: e.clientX, y: e.clientY };
    handleSelStart.current = { ...currentSel };
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
    isMoving,
    startHandleDrag,
    startMoveDrag,
  };
}
