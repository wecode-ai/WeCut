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
import Editor from "./components/Editor";
import type { Selection } from "./components/SelectionOverlay";
import SelectionOverlay from "./components/SelectionOverlay";
import {
  createPinWindow,
  getScreenshotData,
  hideScreenshotWindow,
} from "./hooks/useScreenshot";

type Phase = "idle" | "selecting" | "editing";

const Screenshot = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [bgImage, setBgImage] = useState<string>("");
  const [selection, setSelection] = useState<Selection>({
    h: 0,
    w: 0,
    x: 0,
    y: 0,
  });
  const [pinned, setPinned] = useState(false);

  // 当前窗口 label（用于 pin/close 操作）
  const windowLabel = getCurrentWindow().label;

  // Sync store changes from other windows (e.g. Preferences)
  useTauriListen<Store>(LISTEN_KEY.STORE_CHANGED, ({ payload }) => {
    deepAssign(globalStore, payload.globalStore);
    deepAssign(clipboardStore, payload.clipboardStore);
  });

  const resetState = useCallback(() => {
    setPhase("idle");
    setBgImage("");
    setSelection({ h: 0, w: 0, x: 0, y: 0 });
    setPinned(false);
  }, []);

  // 监听 Rust 端推送的截图 label（show_screenshot_window 中先截图再创建窗口）
  // 收到 label 后主动拉取截图数据
  useTauriListen<string>("screenshot:ready", ({ payload: label }) => {
    // 只处理发给本窗口的消息（label 匹配）
    if (label !== windowLabel) return;
    resetState();
    // 主动拉取截图数据
    getScreenshotData(label).then((data) => {
      if (data) {
        setBgImage(data.image_data_url);
        setPhase("selecting");
      }
    });
  });

  // 页面加载时也尝试主动拉取（处理 emit 先于监听注册的情况）
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getScreenshotData(windowLabel).then((data) => {
      if (data) {
        setBgImage(data.image_data_url);
        setPhase("selecting");
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
    // 重置所有状态
    setPhase("idle");
    setBgImage("");
    setSelection({ h: 0, w: 0, x: 0, y: 0 });
    setPinned(false);
    try {
      // 隐藏窗口（预创建窗口会 hide 保留，动态窗口会 close）
      await hideScreenshotWindow(windowLabel);
    } catch {
      // Window may already be hidden
    }
  };

  const handleSelectionConfirm = (sel: Selection) => {
    setSelection(sel);
    setPhase("editing");
  };

  const handleSelectionMove = (sel: Selection) => {
    setSelection(sel);
  };

  const handlePin = async (dataUrl: string) => {
    try {
      // 创建独立的 pin 窗口，传入编辑后的图像
      await createPinWindow(
        dataUrl,
        selection.x,
        selection.y,
        selection.w,
        selection.h,
      );
      // 隐藏截图窗口，归还给复用池
      await hideScreenshotWindow(windowLabel);
      // 重置状态
      setPhase("idle");
      setBgImage("");
      setSelection({ h: 0, w: 0, x: 0, y: 0 });
      setPinned(false);
    } catch {
      // ignore
    }
  };

  const handleSelectionCancel = async () => {
    await handleClose();
  };

  // Send the screenshot to Wegent by saving to temp file first, then opening send modal
  const handleSendToWegent = async (dataUrl: string) => {
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
    } catch {
      // Send to Wegent failed
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
      {bgImage && !pinned && (
        <img
          alt=""
          src={bgImage}
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
      {phase === "selecting" && bgImage && (
        <SelectionOverlay
          bgImage={bgImage}
          onCancel={handleSelectionCancel}
          onConfirm={handleSelectionConfirm}
        />
      )}

      {/* Editor */}
      {phase === "editing" && bgImage && (
        <Editor
          bgImage={bgImage}
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
