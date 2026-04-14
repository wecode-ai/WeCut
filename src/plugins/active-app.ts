import { invoke } from "@tauri-apps/api/core";

export interface ActiveAppInfo {
  name?: string;
  path?: string;
  bundle_id?: string;
}

export const getActiveApp = () =>
  invoke<ActiveAppInfo>("plugin:eco-active-app|get_active_app");

export const getAppIcon = (bundleId: string, appPath?: string) =>
  invoke<string | null>("plugin:eco-active-app|get_app_icon", {
    appPath,
    bundleId,
  });
