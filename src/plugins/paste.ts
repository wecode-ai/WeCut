import { invoke } from "@tauri-apps/api/core";

export const COMMAND = {
  CHECK_ACCESSIBILITY: "plugin:eco-paste|check_accessibility_permission",
  PASTE: "plugin:eco-paste|paste",
};

/**
 * 检查辅助功能权限
 */
export const checkAccessibilityPermission = async (): Promise<boolean> => {
  return invoke(COMMAND.CHECK_ACCESSIBILITY);
};

/**
 * 粘贴剪贴板内容
 * @returns Promise<void>
 * @throws {string} 当权限被拒绝时抛出 "ACCESSIBILITY_DENIED"
 */
export const paste = async (): Promise<void> => {
  return invoke(COMMAND.PASTE);
};
