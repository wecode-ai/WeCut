import { tempDir } from "@tauri-apps/api/path";
import { writeFile } from "@tauri-apps/plugin-fs";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
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
import { hideScreenshotWindow } from "./hooks/useScreenshot";

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

  // Sync store changes from other windows (e.g. Preferences)
  useTauriListen<Store>(LISTEN_KEY.STORE_CHANGED, ({ payload }) => {
    deepAssign(globalStore, payload.globalStore);
    deepAssign(clipboardStore, payload.clipboardStore);
  });

  // 监听 Rust 端推送的截图数据（show_screenshot_window 中先截图再显示窗口）
  // 收到数据后立即进入 selecting 状态，无需前端再发起截图请求
  const resetState = useCallback(() => {
    setPhase("idle");
    setBgImage("");
    setSelection({ h: 0, w: 0, x: 0, y: 0 });
  }, []);

  useTauriListen<string>("screenshot:ready", ({ payload }) => {
    resetState();
    setBgImage(payload);
    setPhase("selecting");
  });

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
    setPhase("idle");
    try {
      await hideScreenshotWindow();
    } catch {
      // Window may already be hidden
    }
  };

  const handleSelectionConfirm = (sel: Selection) => {
    setSelection(sel);
    setPhase("editing");
  };

  const handleSelectionCancel = async () => {
    await handleClose();
  };

  const handleEditorClose = async () => {
    // Go back to selection phase so user can re-select
    setPhase("selecting");
  };

  // Send the screenshot to Wegent by saving to temp file first, then opening send modal
  const handleSendToWegent = async (dataUrl: string) => {
    try {
      const tmpDir = await tempDir();
      const fileName = `screenshot-${nanoid(8)}.png`;
      const filePath = `${tmpDir}/${fileName}`;

      // Decode base64 and write to temp file
      const base64 = dataUrl.split(",")[1] ?? "";
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await writeFile(filePath, bytes);

      // Create a synthetic history item for the send modal
      const syntheticItem = {
        createTime: new Date().toISOString(),
        favorite: false,
        group: "image" as const,
        id: nanoid(),
        search: "screenshot",
        type: "image" as const,
        value: filePath,
      };

      await hideScreenshotWindow();
      await showSendModalWindow(syntheticItem as any, "aiChat");
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
      {/* Full-screen background image */}
      {bgImage && (
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
          onClose={handleEditorClose}
          onSendToWegent={handleSendToWegent}
          selection={selection}
        />
      )}
    </div>
  );
};

export default Screenshot;
