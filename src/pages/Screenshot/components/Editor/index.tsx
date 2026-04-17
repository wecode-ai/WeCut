import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { message } from "antd";
import { useEffect, useRef, useState } from "react";
import { getCanvasPixelSize } from "@/utils/canvas-hidpi";
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
  onMove,
  onResize,
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

  // Track visual position offset (Cmd+drag moves container only, not canvas content)
  const posOffset = useRef({ x: 0, y: 0 });

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

  // Cmd+drag to move selection
  const isMovingSel = useRef(false);
  const moveDragStart = useRef({ x: 0, y: 0 });
  const moveSelStart = useRef({ h: 0, w: 0, x: 0, y: 0 });

  // ── 选区控制点 hook ──
  const { currentSel, startHandleDrag } = useSelection({
    onResize,
    selection,
  });

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
    try {
      const dataUrl = getFinalDataUrl();
      await copyImageToClipboard(dataUrl);
      message.success("Copied to clipboard");
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
        // 未命中 shape：移动 DOM 容器
        isMovingSel.current = true;
        moveDragStart.current = { x: e.clientX, y: e.clientY };
        moveSelStart.current = { ...selection };
      }
      return;
    }

    drawingMouseDown(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Move container position via Cmd+drag
    if (isMovingSel.current) {
      const dx = e.clientX - moveDragStart.current.x;
      const dy = e.clientY - moveDragStart.current.y;
      posOffset.current = { x: dx, y: dy };
      if (containerRef.current) {
        containerRef.current.style.left = `${selection.x + dx}px`;
        containerRef.current.style.top = `${selection.y + dy}px`;
      }
      return;
    }

    drawingMouseMove(e);

    // Update cursor
    if (canvasRef.current) {
      if (e.metaKey) {
        if (pinned) {
          canvasRef.current.style.cursor = "move";
        } else if (isMovingSel.current || isMovingShape.current) {
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
    if (isMovingSel.current) {
      isMovingSel.current = false;
      onMove?.({
        h: moveSelStart.current.h,
        w: moveSelStart.current.w,
        x: moveSelStart.current.x + posOffset.current.x,
        y: moveSelStart.current.y + posOffset.current.y,
      });
      posOffset.current = { x: 0, y: 0 };
      return;
    }
    drawingMouseUp();
  };

  // ── Pin 窗口尺寸调整 ──
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

  const [toolbarLeft, setToolbarLeft] = useState<number>(
    canvasOffsetX + selection.w,
  );
  // 工具栏垂直偏移（相对于选区容器的 top）
  // 正值 = 选区下方，负值 = 选区上方（外部），或内部偏移（内部模式）
  const [toolbarTop, setToolbarTop] = useState<number>(currentSel.h + 10);

  useEffect(() => {
    if (pinned) return;
    // 用两帧确保 DOM 已渲染，toolbarRef 尺寸已稳定
    let id1: number;
    const id0 = requestAnimationFrame(() => {
      id1 = requestAnimationFrame(() => {
        const toolbarW = toolbarRef.current?.scrollWidth ?? 0;
        const toolbarH = toolbarRef.current?.scrollHeight ?? 0;
        if (toolbarW === 0) return;

        // 水平位置（外部模式）：右对齐选区右边缘，但不超出屏幕左右边界
        const idealLeft = canvasOffsetX + selection.w - toolbarW;
        const minLeft = 8 - selection.x;
        const maxLeft = window.innerWidth - selection.x - toolbarW - 8;
        const clampedLeft = Math.min(Math.max(idealLeft, minLeft), maxLeft);

        // 垂直位置：检测工具栏是否会与 Dock/任务栏冲突
        // screen.availHeight 是不含 Dock/任务栏的可用屏幕高度（macOS 会减去 Dock 高度）
        const toolbarBottomAbs = selection.y + selection.h + 10 + toolbarH;
        const availBottom = screen.availHeight - 8;

        if (toolbarBottomAbs <= availBottom) {
          // 下方空间足够，显示在选区下方（外部）
          setToolbarLeft(clampedLeft);
          setToolbarTop(currentSel.h + 10);
        } else {
          // 下方空间不足，检查上方是否有足够空间
          const toolbarTopAbs = selection.y - 10 - toolbarH;
          if (toolbarTopAbs >= 0) {
            // 上方有足够空间，显示在选区上方（外部）
            setToolbarLeft(clampedLeft);
            setToolbarTop(-(10 + toolbarH));
          } else {
            // 上下都不够，显示在选区内部右上角
            // 内部右上角：距右边缘 8px，距上边缘 8px
            setToolbarLeft(canvasOffsetX + selection.w - toolbarW - 8);
            setToolbarTop(8);
          }
        }
      });
    });
    return () => {
      cancelAnimationFrame(id0);
      cancelAnimationFrame(id1);
    };
  }, [pinned, selection, canvasOffsetX, activeTool, currentSel.h]);

  const menuLeft = canvasOffsetX + selection.w / 2;
  const ocrOverlayVisible = ocrBlocks !== null;
  const canvasPixelSize = getCanvasPixelSize(
    currentSel.w,
    currentSel.h,
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
        left: pinned ? 0 : selection.x,
        position: "fixed",
        top: pinned ? 0 : selection.y,
        zIndex: 20,
      }}
      tabIndex={-1}
    >
      {/* Canvas */}
      {/* Canvas */}
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
          height: currentSel.h,
          marginLeft: canvasOffsetX,
          outline: "none",
          width: currentSel.w,
        }}
        tabIndex={0}
        width={canvasPixelSize.width}
      />
      {/* Hidden bg canvas for mosaic sampling */}
      <canvas ref={bgCanvasRef} style={{ display: "none" }} />

      {/* Selection border + resize handles */}
      <SelectionBorder
        canvasOffsetX={canvasOffsetX}
        currentSel={currentSel}
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
            left: pinned ? menuLeft : toolbarLeft,
            position: "absolute",
            // pinned 模式固定在选区下方；非 pinned 模式使用 toolbarTop
            // toolbarTop 为负值时工具栏显示在选区上方（避免与 Dock 冲突）
            top: pinned ? currentSel.h + 10 : toolbarTop,
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
