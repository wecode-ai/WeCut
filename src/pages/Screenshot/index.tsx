import { tempDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeFile } from "@tauri-apps/plugin-fs";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { LISTEN_KEY } from "@/constants";
import { useTauriListen } from "@/hooks/useTauriListen";
import { showSendModalWindow } from "@/plugins/sendModal";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import type { Store } from "@/types/store";
import { deepAssign } from "@/utils/object";
import {
  logPerf,
  SCREENSHOT_PERF_ACCEPTANCE_TARGETS,
  SCREENSHOT_PERF_METRICS,
} from "@/utils/perf-log";
import { toGlobalSelection } from "@/utils/screenshot-monitor";
import Editor from "./components/Editor";
import type { Selection } from "./components/SelectionOverlay";
import SelectionOverlay from "./components/SelectionOverlay";
import {
  createPinWindow,
  getMonitors,
  getScreenshotCrop,
  getScreenshotData,
  hideScreenshotWindow,
} from "./hooks/useScreenshot";
import { resolveEditorTransition } from "./utils/editor-transition";

type Phase = "idle" | "selecting" | "loadingCrop" | "editing";

const Screenshot = () => {
  const mountStartedAtRef = useRef(performance.now());
  const [phase, setPhase] = useState<Phase>("idle");
  const [previewImageDataUrl, setPreviewImageDataUrl] = useState<string>("");
  const [editorImageDataUrl, setEditorImageDataUrl] = useState<string>("");
  const [editorImageCropped, setEditorImageCropped] = useState(false);
  const [selectionSource, setSelectionSource] = useState<string>("");
  const [previewLogicalSize, setPreviewLogicalSize] = useState({
    h: 0,
    w: 0,
  });
  const [monitorId, setMonitorId] = useState<number>(0);
  const [selection, setSelection] = useState<Selection>({
    h: 0,
    w: 0,
    x: 0,
    y: 0,
  });
  const [pinned, setPinned] = useState(false);
  const selectionConfirmedAtRef = useRef(0);
  const cropRequestIdRef = useRef(0);

  // 当前窗口 label（用于 pin/close 操作）
  const windowLabel = getCurrentWindow().label;

  useEffect(() => {
    logPerf("[screenshot][ui] page:mounted", { windowLabel });
  }, [windowLabel]);

  // Sync store changes from other windows (e.g. Preferences)
  useTauriListen<Store>(LISTEN_KEY.STORE_CHANGED, ({ payload }) => {
    deepAssign(globalStore, payload.globalStore);
    deepAssign(clipboardStore, payload.clipboardStore);
  });

  const resetState = useCallback(() => {
    cropRequestIdRef.current += 1;
    setPhase("idle");
    setPreviewImageDataUrl("");
    setEditorImageDataUrl("");
    setEditorImageCropped(false);
    setSelectionSource("");
    setPreviewLogicalSize({ h: 0, w: 0 });
    setMonitorId(0);
    setSelection({ h: 0, w: 0, x: 0, y: 0 });
    setPinned(false);
  }, []);

  // 监听 Rust 端推送的截图 label（show_screenshot_window 中先截图再创建窗口）
  // 收到 label 后主动拉取截图数据
  useTauriListen<string>("screenshot:ready", ({ payload: label }) => {
    const eventReceivedAt = performance.now();
    logPerf("[screenshot][ui] event:screenshot_ready", {
      elapsedSinceMountMs: Math.round(
        eventReceivedAt - mountStartedAtRef.current,
      ),
      label,
      windowLabel,
    });

    // 只处理发给本窗口的消息（label 匹配）
    if (label !== windowLabel) {
      logPerf("[screenshot][ui] event:screenshot_ready_ignored", {
        reason: "label_mismatch",
      });
      return;
    }

    resetState();
    // 主动拉取截图数据
    const fetchStartedAt = performance.now();
    getScreenshotData(label).then((data) => {
      const fetchElapsedMs = Math.round(performance.now() - fetchStartedAt);
      logPerf("[screenshot][ui] fetch:screenshot_data_done", {
        fetchElapsedMs,
        hasData: Boolean(data),
        source: "event",
      });

      if (data) {
        const applyStartedAt = performance.now();
        setPreviewImageDataUrl(data.previewImageDataUrl);
        setSelectionSource(data.selectionSource);
        setPreviewLogicalSize({
          h: data.logicalHeight,
          w: data.logicalWidth,
        });
        setMonitorId(data.monitorId ?? 0);
        setPhase("selecting");
        logPerf("[screenshot][ui] state:selection_ready", {
          applyElapsedMs: Math.round(performance.now() - applyStartedAt),
          monitorId: data.monitorId ?? 0,
          selectionSource: data.selectionSource,
        });
      }
    });
  });

  // 页面加载时也尝试主动拉取（处理 emit 先于监听注册的情况）
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const fetchStartedAt = performance.now();
    getScreenshotData(windowLabel).then((data) => {
      logPerf("[screenshot][ui] fetch:screenshot_data_done", {
        fetchElapsedMs: Math.round(performance.now() - fetchStartedAt),
        hasData: Boolean(data),
        source: "initial_pull",
      });

      if (data) {
        setPreviewImageDataUrl(data.previewImageDataUrl);
        setSelectionSource(data.selectionSource);
        setPreviewLogicalSize({
          h: data.logicalHeight,
          w: data.logicalWidth,
        });
        setMonitorId(data.monitorId ?? 0);
        setPhase("selecting");
        logPerf("[screenshot][ui] state:selection_ready", {
          monitorId: data.monitorId ?? 0,
          selectionSource: data.selectionSource,
        });
      }
    });
  }, [windowLabel]);

  // ESC key handler at the top level
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = async () => {
    const startedAt = performance.now();
    cropRequestIdRef.current += 1;
    // 重置所有状态
    setPhase("idle");
    setPreviewImageDataUrl("");
    setEditorImageDataUrl("");
    setEditorImageCropped(false);
    setSelectionSource("");
    setPreviewLogicalSize({ h: 0, w: 0 });
    setMonitorId(0);
    setSelection({ h: 0, w: 0, x: 0, y: 0 });
    setPinned(false);
    try {
      // 隐藏窗口（预创建窗口会 hide 保留，动态窗口会 close）
      await hideScreenshotWindow(windowLabel);
      logPerf("[screenshot][ui] action:close_done", {
        elapsedMs: Math.round(performance.now() - startedAt),
        windowLabel,
      });
    } catch {
      // Window may already be hidden
      logPerf("[screenshot][ui] action:close_failed_or_already_hidden", {
        elapsedMs: Math.round(performance.now() - startedAt),
        windowLabel,
      });
    }
  };

  const handleSelectionConfirm = (sel: Selection) => {
    selectionConfirmedAtRef.current = performance.now();
    logPerf("[screenshot][ui] action:selection_confirmed", {
      h: sel.h,
      selectionSource,
      w: sel.w,
      x: sel.x,
      y: sel.y,
    });
    setSelection(sel);
    const requestId = cropRequestIdRef.current + 1;
    cropRequestIdRef.current = requestId;

    const transition = resolveEditorTransition(previewImageDataUrl);
    setEditorImageDataUrl(transition.initialEditorImageDataUrl);
    setEditorImageCropped(transition.initialEditorImageCropped);
    setPhase(transition.phase);

    getScreenshotCrop(windowLabel, sel)
      .then((cropDataUrl) => {
        if (cropRequestIdRef.current !== requestId) return;
        setEditorImageDataUrl(cropDataUrl);
        setEditorImageCropped(true);
        setPhase("editing");
        logPerf("[screenshot][ui] flow:selection_to_editor_ready", {
          elapsedMs: Math.round(
            performance.now() - selectionConfirmedAtRef.current,
          ),
          metric: SCREENSHOT_PERF_METRICS.selectionToEditorReady,
          targetMs: SCREENSHOT_PERF_ACCEPTANCE_TARGETS.selectionToEditorReadyMs,
        });
      })
      .catch((err) => {
        if (cropRequestIdRef.current !== requestId) return;
        if (transition.phase !== "editing") {
          setPhase("selecting");
        }
        logPerf("[screenshot][ui] flow:selection_to_editor_failed", {
          elapsedMs: Math.round(
            performance.now() - selectionConfirmedAtRef.current,
          ),
          error: err instanceof Error ? err.message : String(err),
          fallbackToPreview: transition.phase === "editing",
        });
      });
  };

  const handleSelectionMove = (sel: Selection) => {
    setSelection(sel);
  };

  const handlePin = async (dataUrl: string) => {
    const startedAt = performance.now();
    try {
      const monitors = await getMonitors().catch(() => []);
      const monitor = monitors.find((m) => m.id === monitorId);
      const globalSelection = toGlobalSelection(selection, {
        x: monitor?.x ?? 0,
        y: monitor?.y ?? 0,
      });

      // 创建独立的 pin 窗口，传入编辑后的图像
      await createPinWindow(
        dataUrl,
        globalSelection.x,
        globalSelection.y,
        globalSelection.w,
        globalSelection.h,
      );
      // 隐藏截图窗口，归还给复用池
      await hideScreenshotWindow(windowLabel);
      // 重置状态
      cropRequestIdRef.current += 1;
      setPhase("idle");
      setPreviewImageDataUrl("");
      setEditorImageDataUrl("");
      setEditorImageCropped(false);
      setSelectionSource("");
      setPreviewLogicalSize({ h: 0, w: 0 });
      setSelection({ h: 0, w: 0, x: 0, y: 0 });
      setPinned(false);
      logPerf("[screenshot][ui] action:pin_done", {
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    } catch {
      // ignore
      logPerf("[screenshot][ui] action:pin_failed", {
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    }
  };

  const handleSelectionCancel = async () => {
    await handleClose();
  };

  // Send the screenshot to Wegent by saving to temp file first, then opening send modal
  const handleSendToWegent = async (dataUrl: string) => {
    const startedAt = performance.now();
    try {
      const tmpDir = await tempDir();
      const fileName = `screenshot-${nanoid(8)}.png`;
      const filePath = `${tmpDir}/${fileName}`;

      const base64 = dataUrl.split(",")[1] ?? "";
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await writeFile(filePath, bytes);

      const syntheticItem = {
        createTime: new Date().toISOString(),
        favorite: false,
        group: "image" as const,
        id: nanoid(),
        search: "screenshot",
        type: "image" as const,
        value: filePath,
      };

      await hideScreenshotWindow(windowLabel);
      await showSendModalWindow(syntheticItem as any, "workQueue");
      logPerf("[screenshot][ui] action:send_to_wegent_done", {
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    } catch {
      // Send to Wegent failed
      logPerf("[screenshot][ui] action:send_to_wegent_failed", {
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        left: 0,
        overflow: "hidden",
        position: "fixed",
        top: 0,
        width: "100vw",
      }}
    >
      {/* Full-screen background image — hidden when pinned */}
      {previewImageDataUrl && !pinned && (
        <img
          alt=""
          src={previewImageDataUrl}
          style={{
            display: "block",
            height: "100%",
            left: 0,
            objectFit: "cover",
            pointerEvents: "none",
            position: "absolute",
            top: 0,
            width: "100%",
            zIndex: 0,
          }}
        />
      )}

      {/* Selection overlay */}
      {phase === "selecting" && previewImageDataUrl && (
        <SelectionOverlay
          bgImage={previewImageDataUrl}
          monitorId={monitorId}
          onCancel={handleSelectionCancel}
          onConfirm={handleSelectionConfirm}
        />
      )}

      {/* Editor */}
      {phase === "loadingCrop" && (
        <div
          style={{
            alignItems: "center",
            backdropFilter: "blur(2px)",
            background: "rgba(0,0,0,0.35)",
            color: "#fff",
            display: "flex",
            fontSize: 14,
            height: "100%",
            justifyContent: "center",
            left: 0,
            letterSpacing: 0.2,
            position: "absolute",
            top: 0,
            width: "100%",
            zIndex: 9,
          }}
        >
          正在加载高清截图…
        </div>
      )}

      {phase === "editing" && editorImageDataUrl && (
        <Editor
          bgImage={editorImageDataUrl}
          bgImageCropped={editorImageCropped}
          bgImageLogicalSize={
            editorImageCropped
              ? undefined
              : {
                  h: previewLogicalSize.h || window.innerHeight,
                  w: previewLogicalSize.w || window.innerWidth,
                }
          }
          onClose={handleClose}
          onMove={handleSelectionMove}
          onPin={handlePin}
          onSendToWegent={handleSendToWegent}
          pinned={pinned}
          selection={selection}
        />
      )}
    </div>
  );
};

export default Screenshot;
