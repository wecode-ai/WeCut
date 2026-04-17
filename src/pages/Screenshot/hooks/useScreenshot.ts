import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { logPerf } from "@/utils/perf-log";
import {
  mapScreenshotPreviewPayload,
  type ScreenshotPreviewPayload,
  type ScreenshotPreviewPayloadRaw,
  type ScreenshotSelectionRect,
  toCropRequest,
} from "../utils/session-contract";

export interface MonitorInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  scaleFactor: number;
  x: number;
  y: number;
}

export type ScreenshotData = ScreenshotPreviewPayload;

/**
 * Capture a screenshot of the specified monitor and return it as a base64 data URL.
 */
export const captureMonitor = async (index: number): Promise<string> => {
  const result = await invoke<string>("capture_screen", {
    monitorIndex: index,
  });
  return result;
};

/**
 * Get list of available monitors.
 */
export const getMonitors = async (): Promise<MonitorInfo[]> => {
  const result = await invoke<MonitorInfo[]>("get_monitors");
  return result;
};

/**
 * Show a new screenshot window for the given monitor.
 * Returns the window label (e.g. "screenshot-1").
 */
export const showScreenshotWindow = async (
  monitorId: number,
): Promise<string> => {
  return await invoke<string>("show_screenshot_window", { monitorId });
};

/**
 * Close/hide the screenshot window with the given label.
 */
export const hideScreenshotWindow = async (label?: string): Promise<void> => {
  await invoke("hide_screenshot_window", {
    label: label ?? getCurrentWindow().label,
  });
};

/**
 * Fetch screenshot data by label (one-shot: data is removed from store after retrieval).
 */
export const getScreenshotData = async (
  label: string,
): Promise<ScreenshotData | null> => {
  const raw = await invoke<ScreenshotPreviewPayloadRaw | null>(
    "get_screenshot_data",
    {
      label,
    },
  );
  if (!raw) return null;
  return mapScreenshotPreviewPayload(raw);
};

export const getScreenshotCrop = async (
  label: string,
  selection: ScreenshotSelectionRect,
): Promise<string> => {
  const crop = toCropRequest(selection);
  return await invoke<string>("get_screenshot_crop", {
    h: crop.h,
    label,
    w: crop.w,
    x: crop.x,
    y: crop.y,
  });
};

/**
 * Pin the screenshot window: shrink it to the selection area and keep it always on top.
 * label: the window label returned by showScreenshotWindow.
 * x, y, w, h are logical pixel coordinates of the selection.
 */
export const pinScreenshotWindow = async (
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> => {
  await invoke("pin_screenshot_window", { h, label, w, x, y });
};

export interface PinData {
  image_data_url: string;
  w: number;
  h: number;
  label: string;
}

/**
 * Create a new independent pin window with the given image data URL.
 * Returns the window label (e.g. "pin-1").
 */
export const createPinWindow = async (
  imageDataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<string> => {
  return await invoke<string>("create_pin_window", {
    h,
    imageDataUrl,
    w,
    x,
    y,
  });
};

/**
 * Fetch pin data by label (one-shot: data is removed from store after retrieval).
 */
export const getPinData = async (label: string): Promise<PinData | null> => {
  return await invoke<PinData | null>("get_pin_data", { label });
};

/**
 * Close a pin window by its label.
 */
export const closePinWindow = async (label: string): Promise<void> => {
  await invoke("close_pin_window", { label });
};

/**
 * Save a screenshot data URL to a file chosen by the user via a save dialog.
 * Returns the path where the file was saved.
 */
export const saveScreenshotToFile = async (
  dataUrl: string,
  format: "png" | "jpg",
): Promise<string> => {
  const filters =
    format === "png"
      ? [{ extensions: ["png"], name: "PNG Image" }]
      : [{ extensions: ["jpg", "jpeg"], name: "JPEG Image" }];

  const filePath = await save({
    defaultPath: `screenshot.${format}`,
    filters,
    title: "Save Screenshot",
  });

  if (!filePath) {
    throw new Error("Save cancelled");
  }

  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Invalid data URL");
  }

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await writeFile(filePath, bytes);

  return filePath;
};

/** 屏幕上单个窗口的信息（逻辑像素坐标，相对于所在显示器左上角） */
export interface WindowInfo {
  title: string;
  app_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 获取当前屏幕上所有可见窗口的位置和大小。
 * monitorId: 目标显示器 ID（与 showScreenshotWindow 保持一致）
 */
export const getWindowList = async (
  monitorId: number,
): Promise<WindowInfo[]> => {
  return await invoke<WindowInfo[]>("get_window_list", { monitorId });
};

/** OCR 识别结果中单个文字块的结构 */
export interface OcrBlock {
  text: string;
  /** 归一化 x 坐标（0~1，左上角原点） */
  x: number;
  /** 归一化 y 坐标（0~1，左上角原点） */
  y: number;
  /** 归一化宽度（0~1） */
  w: number;
  /** 归一化高度（0~1） */
  h: number;
}

/**
 * Perform OCR on an image data URL and return an array of text blocks with positions.
 * Each block contains the recognized text and its normalized bounding box (0~1).
 */
export const ocrImage = async (imageDataUrl: string): Promise<OcrBlock[]> => {
  const json = await invoke<string>("ocr_image", { imageDataUrl });
  try {
    return JSON.parse(json) as OcrBlock[];
  } catch {
    return [];
  }
};

/**
 * Copy an image (given as a data URL) to the system clipboard.
 * Uses a direct Rust command to avoid disk IO.
 */
export const copyImageToClipboard = async (dataUrl: string): Promise<void> => {
  logPerf("[clipboard][ui] copy_image:start", {
    dataUrlLength: dataUrl.length,
  });

  const startedAt = performance.now();
  await invoke("copy_image_to_clipboard", { imageDataUrl: dataUrl });
  const elapsedMs = Math.round(performance.now() - startedAt);

  logPerf("[clipboard][ui] copy_image:done", { elapsedMs });
};
