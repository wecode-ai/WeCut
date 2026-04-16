import type { Platform } from "@tauri-apps/plugin-os";
import type { DatabaseSchemaTag } from "./database";

export type Theme = "auto" | "light" | "dark";

export type Language = (typeof LANGUAGE)[keyof typeof LANGUAGE];

export interface Store {
  globalStore: GlobalStore;
  clipboardStore: ClipboardStore;
}

export interface GlobalStore {
  // 应用设置
  app: {
    autoStart: boolean;
    silentStart: boolean;
    showMenubarIcon: boolean;
    showTaskbarIcon: boolean;
    hasCompletedOnboarding: boolean;
  };

  // 外观设置
  appearance: {
    theme: Theme;
    isDark: boolean;
    language?: Language;
  };

  update: {
    auto: boolean;
    beta: boolean;
  };

  // 快捷键设置
  shortcut: {
    clipboard: string;
    preference?: string;
    screenshot?: string;
    quickPaste: {
      enable: boolean;
      value: string;
    };
    pastePlain: string;
    copyFilePath: string;
    wegent?: {
      aiChat?: string;
      workQueue?: string;
    };
    // 兼容旧配置
    send?: string;
  };

  // 截图配置
  screenshot?: {
    shortcut: string;
    saveFormat: "png" | "jpg";
    defaultAction: "copy" | "save" | "menu";
    saveToHistory: boolean;
  };

  // 只在当前系统环境使用
  env: {
    platform?: Platform;
    appName?: string;
    appVersion?: string;
    saveDataDir?: string;
    // 系统环境变量控制的功能开关
    features?: {
      wegentChat?: boolean; // ECO_FEATURE_WEGENT_CHAT 环境变量
    };
  };
}

export type ClickFeedback = "none" | "copy" | "paste";

export type OperationButton =
  | "copy"
  | "pastePlain"
  | "note"
  | "star"
  | "delete"
  | "send";

export interface ClipboardStore {
  // 窗口设置
  window: {
    style: "standard" | "dock";
    position: "remember" | "follow" | "center";
    backTop: boolean;
    showAll: boolean;
    rememberActiveId: boolean;
    dockScale: number;
  };

  // 音效设置
  audio: {
    copy: boolean;
  };

  // 通知设置
  notification: {
    pasteSuccess: boolean;
  };

  // 搜索框设置
  search: {
    position: "top" | "bottom";
    defaultFocus: boolean;
    autoClear: boolean;
  };

  // 剪贴板内容设置
  content: {
    autoPaste: "single" | "double";
    activateAction: "copy" | "paste";
    copyPlain: boolean;
    pastePlain: boolean;
    operationButtons: OperationButton[];
    autoFavorite: boolean;
    deleteConfirm: boolean;
    autoSort: boolean;
    showOriginalContent: boolean;
  };

  // 历史记录
  history: {
    duration: number;
    unit: number;
    maxCount: number;
  };

  // AI 发送基础配置 (旧配置，向后兼容)
  aiSend?: {
    enabled: boolean;
    serviceType: "aiChat" | "workQueue";
    showInUI: boolean;
  };

  // AI Chat (OpenAI) 配置 (旧配置，向后兼容)
  aiChatConfig?: {
    baseUrl: string;
    apiKey: string;
    model: string;
    customHeaders: Record<string, string>;
  };

  // Work Queue 配置 (旧配置，向后兼容)
  workQueueConfig?: {
    baseUrl: string;
    apiToken: string;
    queueName: string;
    defaults: {
      title: string;
      note: string;
    };
  };

  // Wegent 集成配置 (新配置)
  wegent?: {
    aiChat: {
      enabled: boolean;
      baseUrl: string;
      apiKey: string;
      model: string;
      customHeaders: Record<string, string>;
    };
    workQueue: {
      enabled: boolean;
      baseUrl: string;
      apiToken: string;
      queueName: string;
      defaults: {
        title: string;
        note: string;
      };
    };
  };

  // 标签系统
  tags: DatabaseSchemaTag[];
  activeTagId: string | null;

  // UI 状态持久化
  ui: {
    /** 当前激活的标签ID，用于保持标签筛选状态 */
    activeTagId?: string | null;
  };
}
