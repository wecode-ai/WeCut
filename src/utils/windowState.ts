import type { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getSaveWindowStatePath } from "./path";

export type SavedWindowState = Partial<PhysicalPosition & PhysicalSize>;

const windowStateCache = new Map<string, SavedWindowState>();

export const getSavedWindowStates = async (): Promise<
  Record<string, SavedWindowState>
> => {
  const path = await getSaveWindowStatePath();
  const existed = await exists(path);

  if (!existed) return {};

  const states = await readTextFile(path);

  return JSON.parse(states);
};

export const getSavedWindowState = async (label: string) => {
  const states = await getSavedWindowStates();

  return states[label];
};

export const getPreferredWindowState = async (label: string) => {
  return windowStateCache.get(label) ?? (await getSavedWindowState(label));
};

export const cacheWindowState = (label: string, state: SavedWindowState) => {
  windowStateCache.set(label, { ...state });
};

export const writeSavedWindowState = async (state: SavedWindowState) => {
  const path = await getSaveWindowStatePath();
  const states = await getSavedWindowStates();
  const appWindow = getCurrentWebviewWindow();

  cacheWindowState(appWindow.label, state);
  states[appWindow.label] = state;

  return writeTextFile(path, JSON.stringify(states, null, 2));
};
