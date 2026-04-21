import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { cursorPosition } from "@tauri-apps/api/window";
import {
  logPerf,
  SCREENSHOT_PERF_ACCEPTANCE_TARGETS,
  SCREENSHOT_PERF_METRICS,
} from "./perf-log";
import {
  type MonitorBounds,
  resolveMonitorIndexFromPoint,
} from "./screenshot-monitor";

interface ScreenshotMonitorInfo extends MonitorBounds {
  id: number;
  name: string;
  scaleFactor: number;
  isPrimary: boolean;
}

interface TriggerScreenshotOptions {
  hideDelayMs?: number;
}

const createScreenshotRequestId = (): string =>
  `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const resolveMonitorIdFromCursor = async (): Promise<number> => {
  const cursor = await cursorPosition();

  // cursorPosition() 返回物理像素坐标，需转换为逻辑坐标
  // 以匹配 Rust 端 Monitor::from_point 使用的逻辑坐标系
  const appWindow = getCurrentWebviewWindow();
  const scaleFactor = await appWindow.scaleFactor();
  const logical = cursor.toLogical(scaleFactor);
  const x = Math.round(logical.x);
  const y = Math.round(logical.y);

  try {
    return await invoke<number>("get_monitor_id_from_point", { x, y });
  } catch {
    // Fallback: infer id from monitor bounds
    const monitors = await invoke<ScreenshotMonitorInfo[]>("get_monitors");
    const index = resolveMonitorIndexFromPoint(monitors, { x, y });
    return monitors[index]?.id ?? 0;
  }
};

export const triggerScreenshotFromCursor = async (
  options: TriggerScreenshotOptions = {},
): Promise<void> => {
  const requestId = createScreenshotRequestId();
  const startAt = performance.now();
  logPerf(`[screenshot][${requestId}] trigger:start`, { options });

  const resolveStartedAt = performance.now();
  const monitorId = await resolveMonitorIdFromCursor().catch(() => 0);
  logPerf(`[screenshot][${requestId}] trigger:monitor_resolved`, {
    elapsedMs: Math.round(performance.now() - resolveStartedAt),
    monitorId,
  });

  const hideStartedAt = performance.now();
  await invoke("plugin:eco-window|hide_window");
  logPerf(`[screenshot][${requestId}] trigger:main_hidden`, {
    elapsedMs: Math.round(performance.now() - hideStartedAt),
  });

  if (options.hideDelayMs && options.hideDelayMs > 0) {
    const delayStartedAt = performance.now();
    await new Promise((resolve) => setTimeout(resolve, options.hideDelayMs));
    logPerf(`[screenshot][${requestId}] trigger:hide_delay_done`, {
      elapsedMs: Math.round(performance.now() - delayStartedAt),
      hideDelayMs: options.hideDelayMs,
    });
  }

  const showStartedAt = performance.now();
  const label = await invoke<string>("show_screenshot_window", {
    monitorId,
    requestId,
  });
  logPerf(`[screenshot][${requestId}] trigger:screenshot_window_ready`, {
    elapsedMs: Math.round(performance.now() - showStartedAt),
    label,
    metric: SCREENSHOT_PERF_METRICS.windowReady,
    targetMs: SCREENSHOT_PERF_ACCEPTANCE_TARGETS.windowReadyMs,
    totalMs: Math.round(performance.now() - startAt),
  });
};
