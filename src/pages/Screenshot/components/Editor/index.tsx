import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { message } from "antd";
import { useEffect, useRef, useState } from "react";
import { getCanvasPixelSize } from "@/utils/canvas-hidpi";
import { logPerf } from "@/utils/perf-log";
import {
  copyImageToClipboard,
  hideScreenshotWindow,
  type OcrBlock,
  ocrImage,
  saveScreenshotToFile,
} from "../../hooks/useScreenshot";
import Toolbar, { type DrawTool } from "../Toolbar";
import MiniButton from "./MiniButton";
import OcrOverlay from "./OcrOverlay";
import SelectionBorder from "./SelectionBorder";
import type { EditorProps } from "./types";
import { useDrawing } from "./useDrawing";
import { useSelection } from "./useSelection";

// Rust 端 pin 时窗口初始最小宽度（screenshot.rs: min_width = 800）
const PIN_MIN_WIDTH = 800;
// pin 后工具条展开时额外增加的高度
// 主工具栏(52) + 子工具栏(44) + 间距(16) + 底部边距(16)
const PIN_TOOLBAR_HEIGHT = 140;

const Editor: React.FC<EditorProps> = ({
  bgImage,
  bgImageCropped = false,
  bgImageLogicalSize,
  selection,
  onClose,
  onSelectionChange,
  onDragging,
  onPin,
  onSendToWegent,
  pinned = false,
  initialToolbarExpanded = false,
  pinMinWidth = PIN_MIN_WIDTH,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<DrawTool>("rect");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(2);
  const [fontSize, setFontSize] = useState(18);
  // pin 后工具条是否展开（默认收起，点击编辑后展开；可通过 initialToolbarExpanded 初始展开）
  const [toolbarExpanded, setToolbarExpanded] = useState(
    initialToolbarExpanded,
  );
  // pin 模式下鼠标是否在窗口内（控制右上角按钮显示）
  const [pinHovered, setPinHovered] = useState(false);

  // OCR 状态
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrBlocks, setOcrBlocks] = useState<OcrBlock[] | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // ── 选区控制点 + 移动 hook ──
  // currentSel 在 resize/move 时实时更新（用于控制点位置）
  // 移动时：容器固定在原始 selection 位置，只有边框/工具栏/SVG遮罩跟着鼠标走
  const {
    currentSel,
    startHandleDrag,
    startMoveDrag,
    isMoving,
    isDraggingMove,
    isDraggingResize,
    pendingImageUpdate,
    setPendingImageUpdate,
  } = useSelection({
    // 拖拽过程中实时回调（move/resize 共用），仅更新 SVG 遮罩挖空位置
    onDragging,
    // move/resize 结束统一回调，父组件同时更新 selection + bgImage（前端 canvas 裁剪）
    onSelectionChange,
    selection,
  });

  // bgImage 变化时（父组件完成图像更新），重置 pendingImageUpdate 以显示 canvas
  useEffect(() => {
    if (pendingImageUpdate) {
      setPendingImageUpdate(false);
    }
  }, [bgImage, pendingImageUpdate, setPendingImageUpdate]);

  // 容器位置：始终固定在 selection（父组件确认的选区位置）
  // resize/move 拖拽时 canvas 不动，SelectionBorder 用 fixed 定位跟着 currentSel 走
  const containerX = pinned ? 0 : selection.x;
  const containerY = pinned ? 0 : selection.y;

  // ── 绘图 hook ──
  const drawing = useDrawing({
    activeColor,
    activeTool,
    bgCanvasRef,
    bgImageCropped,
    bgImageLogicalSize,
    canvasRef,
    fontSize,
    lineWidth,
    selection,
  });

  const {
    canUndo,
    canRedo,
    textInputPos,
    textInputValue,
    setTextInputValue,
    setTextInputPos,
    loadBgImage,
    undo,
    redo,
    handleMouseDown: drawingMouseDown,
    handleMouseMove: drawingMouseMove,
    handleMouseUp: drawingMouseUp,
    handleMetaMouseDown,
    handleTextConfirm,
    getHitTestResult,
    isMovingShape,
  } = drawing;

  // Load background image
  useEffect(() => {
    loadBgImage(bgImage);
  }, [bgImage, loadBgImage]);

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
    const startedAt = performance.now();
    logPerf("[clipboard][ui] handleCopy:start");
    try {
      const dataUrl = getFinalDataUrl();
      const getDataUrlElapsedMs = Math.round(performance.now() - startedAt);
      logPerf("[clipboard][ui] handleCopy:dataUrl_ready", {
        dataUrlLength: dataUrl.length,
        getDataUrlElapsedMs,
      });

      await copyImageToClipboard(dataUrl);
      const copyDoneElapsedMs = Math.round(performance.now() - startedAt);
      logPerf("[clipboard][ui] handleCopy:copy_done", { copyDoneElapsedMs });

      message.success("Copied to clipboard");
      await hideScreenshotWindow();
      const totalElapsedMs = Math.round(performance.now() - startedAt);
      logPerf("[clipboard][ui] handleCopy:done", { totalElapsedMs });
    } catch (_err) {
      const errorElapsedMs = Math.round(performance.now() - startedAt);
      logPerf("[clipboard][ui] handleCopy:failed", {
        error: String(_err),
        errorElapsedMs,
      });
      message.error("Failed to copy");
    }
  };

  const handleSave = async () => {
    try {
      const dataUrl = getFinalDataUrl();
      const path = await saveScreenshotToFile(dataUrl, "png");
      message.success(`Saved to ${path}`);
      await hideScreenshotWindow();
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

  const handlePin = async () => {
    try {
      const dataUrl = getFinalDataUrl();
      onPin?.(dataUrl);
    } catch {
      message.error("Failed to pin");
    }
  };

  const handleOcr = async () => {
    try {
      setOcrLoading(true);
      setOcrBlocks([]);
      setOcrError(null);
      const dataUrl = getFinalDataUrl();
      const blocks = await ocrImage(dataUrl);
      setOcrBlocks(blocks);
      if (blocks.length === 0) {
        setOcrError("未识别到文字");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setOcrError(`OCR 失败: ${errMsg}`);
      setOcrBlocks([]);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOcrClose = () => {
    setOcrBlocks(null);
    setOcrError(null);
    setOcrLoading(false);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      redo();
    } else if (isMeta && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (isMeta && e.key === "Enter") {
      e.preventDefault();
      if (onSendToWegent) {
        handleSendToWegent();
      }
    } else if (e.key === "Escape") {
      if (ocrBlocks !== null) {
        setOcrBlocks(null);
        setOcrError(null);
      } else {
        onClose();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleCopy();
    }
  };

  // Canvas mouse handlers (wraps drawing hook + Cmd+drag logic)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    if (e.metaKey) {
      if (pinned) {
        getCurrentWindow()
          .startDragging()
          .catch(() => {});
        return;
      }
      // 尝试命中 shape 进入移动模式
      const handled = handleMetaMouseDown(e);
      if (!handled) {
        // 未命中 shape：通过 useSelection 统一处理移动
        startMoveDrag(e);
      }
      return;
    }

    drawingMouseDown(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 移动由 useSelection 全局 mousemove 处理，此处只更新 cursor
    drawingMouseMove(e);

    // Update cursor
    if (canvasRef.current) {
      if (e.metaKey) {
        if (pinned) {
          canvasRef.current.style.cursor = "move";
        } else if (isMoving.current || isMovingShape.current) {
          canvasRef.current.style.cursor = "grabbing";
        } else {
          const hit = getHitTestResult(e);
          canvasRef.current.style.cursor = hit >= 0 ? "grab" : "default";
        }
      } else {
        canvasRef.current.style.cursor =
          activeTool === "text" ? "text" : "crosshair";
      }
    }
  };

  const handleCanvasMouseUp = () => {
    // 移动和缩放的 mouseup 由 useSelection 全局 mouseup 处理
    drawingMouseUp();
  };

  // ── Pin 窗口尺寸调整 ──
  // (posOffset ref 已移除，移动逻辑统一由 useSelection 管理)
  useEffect(() => {
    if (!pinned || !toolbarExpanded) return;
    let id1: number;
    const id0 = requestAnimationFrame(() => {
      id1 = requestAnimationFrame(() => {
        const toolbarW = toolbarRef.current?.scrollWidth ?? 0;
        const requiredW = Math.max(selection.w, toolbarW + 20);
        getCurrentWindow()
          .setSize(new LogicalSize(requiredW, selection.h + PIN_TOOLBAR_HEIGHT))
          .catch(() => {});
      });
    });
    return () => {
      cancelAnimationFrame(id0);
      cancelAnimationFrame(id1);
    };
  }, [pinned, toolbarExpanded, selection]);

  useEffect(() => {
    if (!pinned || toolbarExpanded) return;
    const windowWidth = Math.max(selection.w, pinMinWidth);
    getCurrentWindow()
      .setSize(new LogicalSize(windowWidth, selection.h))
      .catch(() => {});
  }, [pinned, toolbarExpanded, selection, pinMinWidth]);

  // ── 布局计算 ──
  const windowWidth = pinned ? Math.max(selection.w, pinMinWidth) : selection.w;
  const canvasOffsetX = pinned ? (windowWidth - selection.w) / 2 : 0;

  // 工具栏尺寸 ref：初始化后基本固定，用 ref 存储避免触发重渲染
  const toolbarSizeRef = useRef({ h: 0, w: 0 });

  // 初始化时读取工具栏尺寸（两帧确保 DOM 已渲染）
  useEffect(() => {
    if (pinned) return;
    let id1: number;
    const id0 = requestAnimationFrame(() => {
      id1 = requestAnimationFrame(() => {
        const w = toolbarRef.current?.scrollWidth ?? 0;
        const h = toolbarRef.current?.scrollHeight ?? 0;
        if (w > 0) {
          toolbarSizeRef.current = { h, w };
        }
      });
    });
    return () => {
      cancelAnimationFrame(id0);
      cancelAnimationFrame(id1);
    };
  }, [pinned, activeTool]);

  // 工具栏位置：直接从 currentSel 实时计算，不经过 state，消除 rAF 延迟跳动
  // 返回相对于容器（containerX/Y）的偏移量
  const getToolbarPos = () => {
    const toolbarW = toolbarSizeRef.current.w;
    const toolbarH = toolbarSizeRef.current.h;

    // 水平位置：右对齐选区右边缘，但不超出屏幕左右边界
    const idealLeft = canvasOffsetX + currentSel.w - toolbarW;
    const minLeft = 8 - currentSel.x;
    const maxLeft = window.innerWidth - currentSel.x - toolbarW - 8;
    const clampedLeft =
      toolbarW > 0
        ? Math.min(Math.max(idealLeft, minLeft), maxLeft)
        : idealLeft;

    // 垂直位置：检测工具栏是否会与 Dock/任务栏冲突
    // screen.availHeight 是不含 Dock/任务栏的可用屏幕高度（macOS 会减去 Dock 高度）
    const toolbarBottomAbs = currentSel.y + currentSel.h + 10 + toolbarH;
    const availBottom = screen.availHeight - 8;

    if (toolbarH === 0 || toolbarBottomAbs <= availBottom) {
      // 下方空间足够（或尺寸未初始化），显示在选区下方
      return { left: clampedLeft, top: currentSel.h + 10 };
    }

    const toolbarTopAbs = currentSel.y - 10 - toolbarH;
    if (toolbarTopAbs >= 0) {
      // 上方有足够空间，显示在选区上方
      return { left: clampedLeft, top: -(10 + toolbarH) };
    }

    // 上下都不够，显示在选区内部右上角
    return {
      left: canvasOffsetX + currentSel.w - (toolbarW > 0 ? toolbarW + 8 : 8),
      top: 8,
    };
  };

  const toolbarPos = pinned ? null : getToolbarPos();

  const menuLeft = canvasOffsetX + selection.w / 2;
  const ocrOverlayVisible = ocrBlocks !== null;
  // canvas 尺寸始终跟 selection prop（父组件确认的选区），不跟 currentSel（拖拽中实时值）
  // 这样 resize/move 拖拽时 canvas 内容不变，只有边框跟着鼠标走
  // 松开鼠标后父组件更新 selection，canvas 才切换到新尺寸并加载新图像
  const canvasDisplayW = selection.w;
  const canvasDisplayH = selection.h;
  const canvasPixelSize = getCanvasPixelSize(
    canvasDisplayW,
    canvasDisplayH,
    window.devicePixelRatio || 1,
  );

  return (
    <div
      onKeyDown={handleKeyDown}
      onMouseEnter={() => {
        if (pinned) setPinHovered(true);
      }}
      onMouseLeave={() => {
        if (pinned) setPinHovered(false);
      }}
      ref={containerRef}
      style={{
        left: containerX,
        position: "fixed",
        top: containerY,
        zIndex: 20,
      }}
      tabIndex={-1}
    >
      {/* Canvas */}
      {/* 移动时隐藏 canvas，避免原始位置出现残留高亮区域 */}
      <canvas
        height={canvasPixelSize.height}
        onDoubleClick={(e) => {
          if (pinned && !toolbarExpanded) return;
          if (ocrOverlayVisible) return;
          e.preventDefault();
          handleCopy();
        }}
        onMouseDown={(e) => {
          if (ocrOverlayVisible) return;
          if (pinned && !toolbarExpanded) {
            if (e.button === 0) {
              getCurrentWindow()
                .startDragging()
                .catch(() => {});
            }
            return;
          }
          handleCanvasMouseDown(e);
        }}
        onMouseMove={(e) => {
          if (ocrOverlayVisible) return;
          if (pinned && !toolbarExpanded) return;
          handleCanvasMouseMove(e);
        }}
        onMouseUp={(_e) => {
          if (ocrOverlayVisible) return;
          handleCanvasMouseUp();
        }}
        ref={canvasRef}
        style={{
          cursor: ocrOverlayVisible
            ? "default"
            : pinned && !toolbarExpanded
              ? "grab"
              : activeTool === "text"
                ? "text"
                : "crosshair",
          display: "block",
          height: canvasDisplayH,
          marginLeft: canvasOffsetX,
          outline: "none",
          // 移动/resize 拖拽时或等待图像更新时隐藏 canvas，避免旧位置残留高亮或闪烁
          // 父组件同时更新 selection + bgImage（前端 canvas 裁剪），图像就绪后立即显示正确内容
          visibility:
            isDraggingMove || isDraggingResize || pendingImageUpdate
              ? "hidden"
              : "visible",
          width: canvasDisplayW,
        }}
        tabIndex={0}
        width={canvasPixelSize.width}
      />
      {/* Hidden bg canvas for mosaic sampling */}
      <canvas ref={bgCanvasRef} style={{ display: "none" }} />

      {/* Selection border + resize handles */}
      {/* 始终用 fixed + currentSel 绝对坐标，边框实时跟着 currentSel 走，不依赖容器位置 */}
      <SelectionBorder
        canvasOffsetX={canvasOffsetX}
        currentSel={currentSel}
        fixedOrigin={pinned ? null : { x: currentSel.x, y: currentSel.y }}
        onHandleMouseDown={startHandleDrag}
        pinned={pinned}
      />

      {/* Text input overlay */}
      {textInputPos && (
        <input
          onBlur={() => handleTextConfirm(textInputRef)}
          onChange={(e) => setTextInputValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") handleTextConfirm(textInputRef);
            if (e.key === "Escape") {
              setTextInputPos(null);
              setTextInputValue("");
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          ref={textInputRef}
          style={{
            background: "transparent",
            border: "none",
            caretColor: activeColor,
            color: activeColor,
            fontSize,
            fontWeight: 500,
            left: canvasOffsetX + textInputPos.x,
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

      {/* OCR 结果覆盖层 */}
      <OcrOverlay
        blocks={ocrBlocks}
        canvasOffsetX={canvasOffsetX}
        error={ocrError}
        loading={ocrLoading}
        onClose={handleOcrClose}
        selH={currentSel.h}
        selW={currentSel.w}
        visible={ocrOverlayVisible}
      />

      {/* Pin 后右上角迷你操作栏（编辑 + 关闭）— 仅鼠标悬停时显示 */}
      {pinned && !toolbarExpanded && pinHovered && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 4,
            position: "absolute",
            right: 4,
            top: 4,
            zIndex: 35,
          }}
        >
          <MiniButton
            icon="i-lucide:pencil"
            onClick={() => setToolbarExpanded(true)}
            title="编辑"
          />
          <MiniButton icon="i-lucide:x" onClick={onClose} title="关闭" />
        </div>
      )}

      {/* Toolbar */}
      {(!pinned || toolbarExpanded) && (
        <div
          ref={toolbarRef}
          style={{
            // resize/move 时：position fixed，绝对坐标 = currentSel.x/y + toolbarPos 偏移
            // pinned 时：position absolute，居中于选区下方
            // 正常时：position fixed，绝对坐标（容器固定在 selection，需要用 fixed 跟 currentSel）
            left: pinned ? menuLeft : currentSel.x + (toolbarPos?.left ?? 0),
            position: pinned ? "absolute" : "fixed",
            top: pinned
              ? currentSel.h + 10
              : currentSel.y + (toolbarPos?.top ?? currentSel.h + 10),
            transform: pinned ? "translateX(-50%)" : "none",
            zIndex: 30,
          }}
        >
          <Toolbar
            activeColor={activeColor}
            activeTool={activeTool}
            canRedo={canRedo}
            canUndo={canUndo}
            fontSize={fontSize}
            isPinned={pinned}
            lineWidth={lineWidth}
            onClose={onClose}
            onCollapse={() => setToolbarExpanded(false)}
            onColorChange={setActiveColor}
            onCopy={handleCopy}
            onFontSizeChange={setFontSize}
            onLineWidthChange={setLineWidth}
            onOcr={handleOcr}
            onPin={!pinned ? handlePin : undefined}
            onRedo={redo}
            onSave={handleSave}
            onSendToWegent={onSendToWegent ? handleSendToWegent : undefined}
            onToolChange={setActiveTool}
            onUndo={undo}
          />
        </div>
      )}
    </div>
  );
};

export default Editor;
export type { EditorProps, Selection } from "./types";
