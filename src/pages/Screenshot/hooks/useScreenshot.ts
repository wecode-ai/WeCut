import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { writeImage } from "tauri-plugin-clipboard-x-api";

export interface MonitorInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  scaleFactor: number;
  x: number;
  y: number;
}

/**
 * Capture a screenshot of the specified monitor and return it as a base64 data URL.
 */
export const captureMonitor = async (index: number): Promise<string> => {
  const result = await invoke<string>("capture_screen", { monitorIndex: index });
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
 * Show the screenshot window for the given monitor.
 */
export const showScreenshotWindow = async (
  monitorIndex: number,
): Promise<void> => {
  await invoke("show_screenshot_window", { monitorIndex });
};

/**
 * Hide the screenshot window.
 */
export const hideScreenshotWindow = async (): Promise<void> => {
  await invoke("hide_screenshot_window");
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

  // Strip the data URL prefix and decode base64
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

/**
 * Copy an image (given as a data URL) to the system clipboard.
 */
export const copyImageToClipboard = async (dataUrl: string): Promise<void> => {
  await writeImage(dataUrl);
};
