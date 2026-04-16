import { proxy } from "valtio";
import type { GlobalStore } from "@/types/store";
import { isMac } from "@/utils/is";

export const globalStore = proxy<GlobalStore>({
  app: {
    autoStart: false,
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
    shortcut: isMac ? "Command+Control+KeyA" : "Control+Alt+KeyA",
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
    screenshot: isMac ? "Command+Control+KeyA" : "Control+Alt+KeyA",
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
