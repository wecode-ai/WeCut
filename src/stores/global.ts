import { proxy } from "valtio";
import type { GlobalStore } from "@/types/store";

export const globalStore = proxy<GlobalStore>({
  app: {
    autoStart: false,
    showMenubarIcon: true,
    showTaskbarIcon: false,
    silentStart: false,
    hasCompletedOnboarding: false,
  },

  appearance: {
    isDark: false,
    theme: "auto",
  },

  env: {},

  shortcut: {
    clipboard: "Alt+C",
    copyFilePath: "",
    pastePlain: "",
    preference: "Alt+X",
    screenshot: "CmdOrCtrl+Shift+X",
    quickPaste: {
      enable: false,
      value: "Command+Shift",
    },
    // 兼容旧配置
    send: "",
    wegent: {
      aiChat: "",
      workQueue: "",
    },
  },

  screenshot: {
    defaultAction: "menu",
    saveFormat: "png",
    saveToHistory: true,
    shortcut: "CmdOrCtrl+Shift+X",
  },

  update: {
    auto: false,
    beta: false,
  },
});
