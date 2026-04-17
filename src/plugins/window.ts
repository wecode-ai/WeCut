import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { LISTEN_KEY, WINDOW_LABEL } from "@/constants";
import { calculateMainWindowLayout } from "@/plugins/window-layout";
import { clipboardStore } from "@/stores/clipboard";
import type { WindowLabel } from "@/types/plugin";
import { isLinux } from "@/utils/is";
import { getCursorMonitor } from "@/utils/monitor";
import { getPreferredWindowState } from "@/utils/windowState";

const COMMAND = {
  HIDE_ONBOARDING_WINDOW: "plugin:eco-window|hide_onboarding_window",
  HIDE_TOAST_WINDOW: "plugin:eco-window|hide_toast_window",
  HIDE_WINDOW: "plugin:eco-window|hide_window",
  SHOW_ONBOARDING_WINDOW: "plugin:eco-window|show_onboarding_window",
  SHOW_TASKBAR_ICON: "plugin:eco-window|show_taskbar_icon",
  SHOW_TOAST_WINDOW: "plugin:eco-window|show_toast_window",
  SHOW_WINDOW: "plugin:eco-window|show_window",
};

export const applyMainWindowLayout = async () => {
  const appWindow = getCurrentWebviewWindow();

  if (appWindow.label !== WINDOW_LABEL.MAIN) return;

  const [{ window }, scaleFactor, monitor, currentSize, preferredState] =
    await Promise.all([
      Promise.resolve(clipboardStore),
      appWindow.scaleFactor(),
      getCursorMonitor(),
      appWindow.innerSize(),
      getPreferredWindowState(appWindow.label),
    ]);

  const nextLayout = calculateMainWindowLayout({
    currentSize,
    dockScale: window.dockScale,
    fallbackState: preferredState,
    monitor,
    savedState: preferredState,
    scaleFactor,
    style: window.style,
    windowPosition: window.position,
  });

  if (nextLayout.size) {
    await appWindow.setSize(
      new PhysicalSize(nextLayout.size.width, nextLayout.size.height),
    );
  }

  if (nextLayout.position) {
    await appWindow.setPosition(
      new PhysicalPosition(nextLayout.position.x, nextLayout.position.y),
    );
  }
};

/**
 * 显示窗口
 */
export const showWindow = (label?: WindowLabel) => {
  if (label) {
    emit(LISTEN_KEY.SHOW_WINDOW, label);
  } else {
    invoke(COMMAND.SHOW_WINDOW);
  }
};

/**
 * 隐藏窗口
 */
export const hideWindow = () => {
  invoke(COMMAND.HIDE_WINDOW);
};

/**
 * 切换窗口的显示和隐藏
 */
export const toggleWindowVisible = async () => {
  const appWindow = getCurrentWebviewWindow();

  let focused = await appWindow.isFocused();

  if (isLinux) {
    focused = await appWindow.isVisible();
  }

  if (focused) {
    return hideWindow();
  }

  if (appWindow.label === WINDOW_LABEL.MAIN) {
    const { window } = clipboardStore;

    // 激活时回到顶部
    if (window.backTop) {
      await emit(LISTEN_KEY.ACTIVATE_BACK_TOP);
    }

    await applyMainWindowLayout();
  }

  showWindow();
};

/**
 * 显示任务栏图标
 */
export const showTaskbarIcon = (visible = true) => {
  invoke(COMMAND.SHOW_TASKBAR_ICON, { visible });
};

/**
 * 显示 Toast 窗口（粘贴成功提示）
 */
export const showToastWindow = async () => {
  await invoke(COMMAND.SHOW_TOAST_WINDOW);
};

/**
 * 显示 Onboarding 窗口（引导页）
 */
export const showOnboardingWindow = async () => {
  await invoke(COMMAND.SHOW_ONBOARDING_WINDOW);
};

/**
 * 隐藏 Onboarding 窗口（引导页）
 */
export const hideOnboardingWindow = async () => {
  await invoke(COMMAND.HIDE_ONBOARDING_WINDOW);
};

/**
 * 隐藏 Toast 窗口
 */
export const hideToastWindow = async () => {
  await invoke(COMMAND.HIDE_TOAST_WINDOW);
};
