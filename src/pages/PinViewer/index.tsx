import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import Editor from "@/pages/Screenshot/components/Editor";
import MiniButton from "@/pages/Screenshot/components/Editor/MiniButton";
import {
  closePinWindow,
  getPinData,
} from "@/pages/Screenshot/hooks/useScreenshot";

interface PinData {
  image_data_url: string;
  w: number;
  h: number;
  label: string;
}

/** 从 URL hash 中解析 query 参数，例如 /#/pin-viewer?label=pin-1 */
function getLabelFromHash(): string {
  const hash = window.location.hash; // e.g. "#/pin-viewer?label=pin-1"
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return "";
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return params.get("label") ?? "";
}

const PinViewer = () => {
  const [data, setData] = useState<PinData | null>(null);
  const [showButtons, setShowButtons] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelRef = useRef<string>("");

  useEffect(() => {
    const label = getLabelFromHash();
    labelRef.current = label;
    if (!label) return;

    // 主动拉取数据，重试最多 20 次（每次间隔 100ms），共 2s
    let attempts = 0;
    const maxAttempts = 20;

    const tryFetch = async () => {
      try {
        const result = await getPinData(label);
        if (result) {
          setData(result);
          return;
        }
      } catch {
        // ignore
      }
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryFetch, 100);
      }
    };

    tryFetch();

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);
  // ESC 键关闭当前 pin 窗口（使用 capture 阶段，阻止所有其他监听器处理）
  const closingRef = useRef(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (closingRef.current) return;
        closingRef.current = true;
        const label = labelRef.current || getCurrentWindow().label;
        closePinWindow(label).catch(() => {
          getCurrentWindow()
            .close()
            .catch(() => {});
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);
  // 支持 drag 拖动窗口
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWindow()
        .startDragging()
        .catch(() => {});
    }
  };

  const handleClose = async () => {
    const label = labelRef.current || getCurrentWindow().label;
    try {
      await closePinWindow(label);
    } catch {
      await getCurrentWindow().close();
    }
  };

  const handleMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShowButtons(true);
  };

  const handleMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setShowButtons(false);
    }, 300);
  };

  if (!data) {
    return (
      <div
        style={{
          background: "transparent",
          height: "100vh",
          width: "100vw",
        }}
      />
    );
  }

  // 编辑模式：使用 Editor 组件（pinned=true，工具栏初始展开，不强制最小宽度）
  if (editMode) {
    return (
      <Editor
        bgImage={data.image_data_url}
        bgImageCropped
        initialToolbarExpanded
        onClose={handleClose}
        pinMinWidth={0}
        pinned
        selection={{ h: data.h, w: data.w, x: 0, y: 0 }}
      />
    );
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        width: "100vw",
      }}
    >
      {/* 截图图片 — 可拖动 */}
      <img
        alt="pin"
        draggable={false}
        onMouseDown={handleMouseDown}
        src={data.image_data_url}
        style={{
          cursor: "grab",
          display: "block",
          height: data.h,
          left: "50%",
          objectFit: "fill",
          position: "absolute",
          top: 0,
          transform: "translateX(-50%)",
          userSelect: "none",
          width: data.w,
        }}
      />

      {/* 选区边框 */}
      <div
        style={{
          border: "1.5px solid rgba(255,255,255,0.9)",
          boxShadow: "0 0 0 1.5px rgba(0,0,0,0.5), 0 4px 24px rgba(0,0,0,0.6)",
          boxSizing: "border-box",
          height: data.h,
          left: "50%",
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          transform: "translateX(-50%)",
          width: data.w,
          zIndex: 10,
        }}
      />

      {/* 悬停时显示编辑和关闭按钮 */}
      {showButtons && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 4,
            position: "absolute",
            right: 4,
            top: 4,
            zIndex: 20,
          }}
        >
          <MiniButton
            icon="i-lucide:pencil"
            onClick={() => setEditMode(true)}
            title="编辑"
          />
          <MiniButton icon="i-lucide:x" onClick={handleClose} title="关闭" />
        </div>
      )}
    </div>
  );
};

export default PinViewer;
