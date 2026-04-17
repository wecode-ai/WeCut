import { HappyProvider } from "@ant-design/happy-work-theme";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { error } from "@tauri-apps/plugin-log";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useBoolean, useEventListener, useKeyPress, useMount } from "ahooks";
import { ConfigProvider, theme } from "antd";
import { isString } from "es-toolkit";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useSnapshot } from "valtio";
import { LISTEN_KEY, PRESET_SHORTCUT } from "./constants";
import { ShortcutProvider } from "./contexts/ShortcutContext";
import { destroyDatabase } from "./database";
import { useImmediateKey } from "./hooks/useImmediateKey";
import { useTauriListen } from "./hooks/useTauriListen";
import { useWindowState } from "./hooks/useWindowState";
import { getAntdLocale, i18n } from "./locales";
import {
  applyMainWindowLayout,
  hideWindow,
  showOnboardingWindow,
  showWindow,
} from "./plugins/window";
import { router } from "./router";
import { tagActions } from "./stores/clipboard";
import { globalStore } from "./stores/global";
import { textExpansionActions } from "./stores/textExpansion";
import { generateColorVars } from "./utils/color";
import { isURL } from "./utils/is";
import { restoreStore } from "./utils/store";

const { defaultAlgorithm, darkAlgorithm } = theme;

const App = () => {
  const { appearance } = useSnapshot(globalStore);
  const { restoreState } = useWindowState();
  const [ready, { toggle }] = useBoolean();

  useMount(async () => {
    await restoreStore();

    // 初始化加载标签和文本扩展数据（在 restoreStore 完成后）
    await tagActions.loadTags();
    await textExpansionActions.loadExpansions();

    await restoreState();
    await applyMainWindowLayout();

    toggle();

    // 生成 antd 的颜色变量
    generateColorVars();
  });

  // 若未完成引导，显示引导窗口（在 RouterProvider 渲染后执行）
  useEffect(() => {
    if (ready && !globalStore.app.hasCompletedOnboarding) {
      showOnboardingWindow();
    }
  }, [ready]);

  // 监听语言的变化
  useImmediateKey(globalStore.appearance, "language", i18n.changeLanguage);

  // 监听是否是暗黑模式
  useImmediateKey(globalStore.appearance, "isDark", (value) => {
    if (value) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  });

  // 监听显示窗口的事件
  useTauriListen(LISTEN_KEY.SHOW_WINDOW, ({ payload }) => {
    const appWindow = getCurrentWebviewWindow();

    if (appWindow.label !== payload) return;

    showWindow();
  });

  // 监听关闭数据库的事件
  useTauriListen(LISTEN_KEY.CLOSE_DATABASE, destroyDatabase);

  // 链接跳转到系统浏览器
  useEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest("a");

    if (!link) return;

    const { href, target } = link;

    if (target === "_blank") return;

    event.preventDefault();

    if (!isURL(href)) return;

    openUrl(href);
  });

  // 隐藏窗口（pin 窗口由 PinViewer 自行处理 ESC，此处跳过）
  useKeyPress(["esc", PRESET_SHORTCUT.HIDE_WINDOW], () => {
    const label = getCurrentWebviewWindow().label;
    if (label.startsWith("pin-")) return;
    hideWindow();
  });

  // 监听 promise 的错误，输出到日志
  useEventListener("unhandledrejection", ({ reason }) => {
    const message = isString(reason) ? reason : JSON.stringify(reason);

    error(message);
  });

  return (
    <ShortcutProvider>
      <ConfigProvider
        locale={getAntdLocale(appearance.language)}
        theme={{
          algorithm: appearance.isDark ? darkAlgorithm : defaultAlgorithm,
        }}
      >
        <HappyProvider>
          {ready && <RouterProvider router={router} />}
        </HappyProvider>
      </ConfigProvider>
    </ShortcutProvider>
  );
};

export default App;
