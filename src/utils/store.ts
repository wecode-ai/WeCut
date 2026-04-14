import { getName, getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { omit } from "es-toolkit/compat";
import { getLocale } from "tauri-plugin-locale-api";
import { keys } from "@/components/ProShortcut/keyboard";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import type { Language, Store } from "@/types/store";
import { DEFAULTS } from "@/utils/envConfig";
import { deepAssign } from "./object";
import { getSaveStorePath } from "./path";

/**
 * 将 hookKey 格式的快捷键（如 "meta.shift.x"）转换为 tauriKey 格式（如 "Command+Shift+KeyX"）
 * 如果已经是 tauriKey 格式则原样返回
 */
const migrateShortcutToTauriFormat = (shortcut: string): string => {
  if (!shortcut) return shortcut;

  // 如果包含 + 分隔符，说明已经是 tauriKey 格式
  if (shortcut.includes("+")) return shortcut;

  // hookKey 格式用 . 分隔
  const parts = shortcut.split(".");
  const tauriParts = parts.map((part) => {
    const matched = keys.find((k) => k.hookKey === part);
    return matched?.tauriKey ?? part;
  });

  return tauriParts.join("+");
};

/**
 * 初始化配置项
 */
const initStore = async () => {
  globalStore.appearance.language ??= await getLocale<Language>();
  globalStore.env.platform = platform();
  globalStore.env.appName = await getName();
  globalStore.env.appVersion = await getVersion();
  globalStore.env.saveDataDir ??= await appDataDir();

  // 读取系统环境变量控制功能开关
  const wegentChatEnv = await invoke<string | null>("get_system_env", {
    key: "ECO_FEATURE_WEGENT_CHAT",
  });
  globalStore.env.features = {
    wegentChat: wegentChatEnv === "1" || wegentChatEnv === "true",
  };

  // @ts-expect-error
  if (clipboardStore.window.style === "float") {
    clipboardStore.window.style = "standard";
  }

  // 数据迁移：确保 operationButtons 包含 send
  const operationButtons = clipboardStore.content.operationButtons;
  if (!operationButtons.includes("send")) {
    // 在 delete 之前插入 send
    const deleteIndex = operationButtons.indexOf("delete");
    if (deleteIndex !== -1) {
      operationButtons.splice(deleteIndex, 0, "send");
    } else {
      operationButtons.push("send");
    }
  }

  // 数据迁移：截图快捷键格式从 hookKey 迁移到 tauriKey
  migrateScreenshotShortcut();

  // 数据迁移：从旧版 aiSend 配置迁移到新版结构
  migrateAiSendConfig();

  // 数据迁移：从旧配置迁移到新的 wegent 结构
  migrateToWegentConfig();

  // 恢复 UI 状态：从 persisted ui.activeTagId 恢复 activeTagId
  if (clipboardStore.ui?.activeTagId !== undefined) {
    clipboardStore.activeTagId = clipboardStore.ui.activeTagId;
  }

  await mkdir(globalStore.env.saveDataDir, { recursive: true });
};

/**
 * 迁移截图快捷键格式：从 hookKey（meta.shift.x）迁移到 tauriKey（Command+Shift+KeyX）
 */
const migrateScreenshotShortcut = () => {
  const screenshotShortcut = globalStore.shortcut.screenshot;

  if (screenshotShortcut?.includes(".")) {
    const migrated = migrateShortcutToTauriFormat(screenshotShortcut);
    globalStore.shortcut.screenshot = migrated;

    if (globalStore.screenshot) {
      globalStore.screenshot.shortcut = migrated;
    }
  }
};

/**
 * 迁移 AI 发送配置
 * 从旧版 aiSend 配置（包含所有字段）迁移到新版结构（aiSend + aiChatConfig + workQueueConfig）
 */
const migrateAiSendConfig = () => {
  const aiSend = clipboardStore.aiSend;

  // 如果存在旧版 aiSend 配置（有 baseUrl 字段），进行迁移
  if (aiSend && "baseUrl" in aiSend) {
    const oldConfig = aiSend as any;

    // 迁移到 aiChatConfig
    clipboardStore.aiChatConfig = {
      apiKey: oldConfig.apiKey || "",
      baseUrl: oldConfig.baseUrl || DEFAULTS.AI_CHAT_URL,
      customHeaders: oldConfig.customHeaders || {},
      model: oldConfig.model || DEFAULTS.AI_MODEL,
    };

    // 初始化 workQueueConfig
    clipboardStore.workQueueConfig = {
      apiToken: "",
      baseUrl: DEFAULTS.WORK_QUEUE_URL,
      defaults: {
        note: "",
        title: "",
      },
      queueName: "",
    };

    // 更新 aiSend 为基础配置
    clipboardStore.aiSend = {
      enabled: oldConfig.enabled ?? true,
      serviceType: "aiChat",
      showInUI: oldConfig.showInUI ?? true,
    };
  }

  // 确保 aiSend 配置存在
  if (!clipboardStore.aiSend) {
    clipboardStore.aiSend = {
      enabled: true,
      serviceType: "aiChat",
      showInUI: true,
    };
  }

  // 确保 aiSend.serviceType 存在（从旧版本迁移）
  if (!clipboardStore.aiSend.serviceType) {
    clipboardStore.aiSend.serviceType = "aiChat";
  }

  // 确保 aiChatConfig 存在
  if (!clipboardStore.aiChatConfig) {
    clipboardStore.aiChatConfig = {
      apiKey: "",
      baseUrl: DEFAULTS.AI_CHAT_URL,
      customHeaders: {},
      model: DEFAULTS.AI_MODEL,
    };
  }

  // 确保 workQueueConfig 存在
  if (!clipboardStore.workQueueConfig) {
    clipboardStore.workQueueConfig = {
      apiToken: "",
      baseUrl: DEFAULTS.WORK_QUEUE_URL,
      defaults: {
        note: "",
        title: "",
      },
      queueName: "",
    };
  }
};

/**
 * 迁移到新的 wegent 配置结构
 * 从旧版 aiSend/aiChatConfig/workQueueConfig 迁移到新的 wegent 结构
 */
const migrateToWegentConfig = () => {
  // 如果 wegent 配置已存在，跳过迁移
  if (clipboardStore.wegent) {
    return;
  }

  const aiSend = clipboardStore.aiSend;
  const aiChatConfig = clipboardStore.aiChatConfig;
  const workQueueConfig = clipboardStore.workQueueConfig;

  // 初始化 wegent 配置
  clipboardStore.wegent = {
    aiChat: {
      apiKey: aiChatConfig?.apiKey || "",
      baseUrl: aiChatConfig?.baseUrl || DEFAULTS.AI_CHAT_URL,
      customHeaders: aiChatConfig?.customHeaders || {},
      enabled: aiSend?.enabled ?? true,
      model: aiChatConfig?.model || DEFAULTS.AI_MODEL,
    },
    workQueue: {
      apiToken: workQueueConfig?.apiToken || "",
      baseUrl: workQueueConfig?.baseUrl || DEFAULTS.WORK_QUEUE_URL,
      defaults: {
        note: workQueueConfig?.defaults?.note || "",
        title: workQueueConfig?.defaults?.title || "",
      },
      enabled: aiSend?.serviceType === "workQueue",
      queueName: workQueueConfig?.queueName || "",
    },
  };

  // 迁移快捷键配置
  if (globalStore.shortcut.send && !globalStore.shortcut.wegent) {
    // 旧配置只有一个 send 快捷键，迁移到 aiChat
    globalStore.shortcut.wegent = {
      aiChat: globalStore.shortcut.send,
      workQueue: "",
    };
  }
};

/**
 * 本地存储配置项
 * @param backup 是否为备份数据
 */
export const saveStore = async (backup = false) => {
  const store = { clipboardStore, globalStore };

  const path = await getSaveStorePath(backup);

  const content = JSON.stringify(store, null, 2);
  return writeTextFile(path, content);
};

/**
 * 从本地存储恢复配置项
 * @param backup 是否为备份数据
 */
export const restoreStore = async (backup = false) => {
  const path = await getSaveStorePath(backup);

  const existed = await exists(path);

  if (existed) {
    const content = await readTextFile(path);
    const store: Store = JSON.parse(content);
    const nextGlobalStore = omit(store.globalStore, backup ? "env" : "");

    deepAssign(globalStore, nextGlobalStore);
    deepAssign(clipboardStore, store.clipboardStore);
  }

  if (backup) return;

  return initStore();
};
