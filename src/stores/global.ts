import { proxy } from "valtio";
import type { GlobalStore } from "@/types/store";
import { isMac } from "@/utils/is";

export const globalStore = proxy<GlobalStore>({
  app: {
    autoStart: false,
    hasCompletedOnboarding: false,
    showMenubarIcon: true,
    showTaskbarIcon: false,
    silentStart: false,
  },

  appearance: {
    isDark: false,
    theme: "auto",
  },

  env: {},

  screenshot: {
    defaultAction: "menu",
    saveFormat: "png",
    saveToHistory: true,
    shortcut: isMac ? "Command+Control+A" : "Control+Alt+A",
  },

  shortcut: {
    clipboard: "Alt+C",
    copyFilePath: "",
    pastePlain: "",
    preference: "Alt+X",
    quickPaste: {
      enable: false,
      value: "Command+Shift",
    },
    screenshot: isMac ? "Command+Control+A" : "Control+Alt+A",
    // 兼容旧配置
    send: "",
    wegent: {
      aiChat: "",
      workQueue: "",
    },
  },

  update: {
    auto: false,
    beta: false,
  },
});
