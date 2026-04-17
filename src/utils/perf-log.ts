import { info } from "@tauri-apps/plugin-log";

export const SCREENSHOT_PERF_METRICS = {
  firstFrameDrawn: "event:screenshot_ready -> overlay:first_frame_drawn",
  selectionToEditorReady: "selection_confirm -> editor_ready",
  windowReady: "trigger:start -> trigger:screenshot_window_ready",
} as const;

export const SCREENSHOT_PERF_ACCEPTANCE_TARGETS = {
  firstFrameAfterReadyMs: 250,
  selectionToEditorReadyMs: 350,
  windowReadyMs: 1000,
} as const;

const stringifyPayload = (payload: Record<string, unknown>): string => {
  try {
    return JSON.stringify(payload);
  } catch {
    return '{"payload":"unserializable"}';
  }
};

export const logPerf = (
  message: string,
  payload?: Record<string, unknown>,
): void => {
  const line = payload ? `${message} ${stringifyPayload(payload)}` : message;
  void info(line);
};
