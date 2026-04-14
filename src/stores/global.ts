import { proxy } from "valtio";
import type { GlobalStore } from "@/types/store";

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

  shortcut: {
    clipboard: "Alt+C",
    copyFilePath: "",
    pastePlain: "",
    preference: "Alt+X",
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

  update: {
    auto: false,
    beta: false,
  },
});
