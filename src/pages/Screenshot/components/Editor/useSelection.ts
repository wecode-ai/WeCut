import { useEffect, useRef, useState } from "react";
import type { HandleType, Selection } from "./types";

interface UseSelectionOptions {
  selection: Selection;
  onResize?: (sel: Selection) => void;
}

export function useSelection({ selection, onResize }: UseSelectionOptions) {
  const [currentSel, setCurrentSel] = useState<Selection>(selection);
  const currentSelRef = useRef<Selection>(selection);

  // 控制点拖拽状态
  const activeHandle = useRef<HandleType | null>(null);
  const handleDragStart = useRef({ x: 0, y: 0 });
  const handleSelStart = useRef<Selection>({ h: 0, w: 0, x: 0, y: 0 });

  // 同步 selection prop 变化
  useEffect(() => {
    setCurrentSel(selection);
  }, [selection]);

  // 用 ref 跟踪最新 currentSel，供全局 mouseup 读取
  useEffect(() => {
    currentSelRef.current = currentSel;
  }, [currentSel]);

  // 控制点拖拽：全局 mousemove / mouseup
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!activeHandle.current) return;
      const { x: sx, y: sy, w: sw, h: sh } = handleSelStart.current;
      const dx = e.clientX - handleDragStart.current.x;
      const dy = e.clientY - handleDragStart.current.y;

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

      nw = Math.max(10, nw);
      nh = Math.max(10, nh);

      setCurrentSel({ h: nh, w: nw, x: nx, y: ny });
    };

    const onMouseUp = () => {
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
  }, [onResize]);

  const startHandleDrag = (e: React.MouseEvent, key: HandleType) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    activeHandle.current = key;
    handleDragStart.current = { x: e.clientX, y: e.clientY };
    handleSelStart.current = { ...currentSel };
  };

  return {
    activeHandle,
    currentSel,
    currentSelRef,
    startHandleDrag,
  };
}
