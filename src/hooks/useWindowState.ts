import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import type { Event } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useMount, useReactive } from "ahooks";
import { WINDOW_LABEL } from "@/constants";
import { clipboardStore } from "@/stores/clipboard";
import {
  cacheWindowState,
  getSavedWindowState,
  writeSavedWindowState,
} from "@/utils/windowState";
import { useTauriFocus } from "./useTauriFocus";

const appWindow = getCurrentWebviewWindow();
const { label } = appWindow;

const isDockMainWindow = () => {
  return label === WINDOW_LABEL.MAIN && clipboardStore.window.style === "dock";
};

export const useWindowState = () => {
  const state = useReactive<Partial<PhysicalPosition & PhysicalSize>>({});

  useMount(() => {
    appWindow.onMoved(onChange);

    appWindow.onResized(onChange);
  });

  useTauriFocus({
    onBlur() {
      saveState();
    },
  });

  const onChange = async (event: Event<PhysicalPosition | PhysicalSize>) => {
    if (isDockMainWindow()) return;

    const minimized = await appWindow.isMinimized();

    if (minimized) return;

    Object.assign(state, event.payload);
    cacheWindowState(label, state);
  };

  const saveState = async () => {
    if (isDockMainWindow()) return;
    return writeSavedWindowState(state);
  };

  const restoreState = async () => {
    if (isDockMainWindow()) return;

    const savedState = await getSavedWindowState(label);

    Object.assign(state, savedState);
    cacheWindowState(label, state);

    const { x, y, width, height } = state;

    if (typeof x === "number" && typeof y === "number") {
      appWindow.setPosition(new PhysicalPosition(x, y));
    }

    if (typeof width === "number" && typeof height === "number") {
      appWindow.setSize(new PhysicalSize(width, height));
    }
  };

  return {
    restoreState,
    saveState,
  };
};
