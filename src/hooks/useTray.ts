import { emit } from "@tauri-apps/api/event";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { resolveResource } from "@tauri-apps/api/path";
import { TrayIcon, type TrayIconOptions } from "@tauri-apps/api/tray";
import { exit, relaunch } from "@tauri-apps/plugin-process";
import { useBoolean, useUpdateEffect } from "ahooks";
import { useTranslation } from "react-i18next";
import { LISTEN_KEY } from "@/constants";
import { showWindow } from "@/plugins/window";
import { globalStore } from "@/stores/global";
import { isMac } from "@/utils/is";
import { triggerScreenshotFromCursor } from "@/utils/screenshot-trigger";
import { useSubscribeKey } from "./useSubscribeKey";

const TRAY_ID = "app-tray";

const triggerScreenshot = async () => {
  try {
    await triggerScreenshotFromCursor({ hideDelayMs: 100 });
  } catch {
    // Screenshot trigger failed
  }
};

export const useTray = () => {
  const [startListen] = useBoolean(true);
  const { t } = useTranslation();

  // 监听是否显示菜单栏图标
  useSubscribeKey(globalStore.app, "showMenubarIcon", async (value) => {
    const tray = await getTrayById();

    if (tray) {
      tray.setVisible(value);
    } else {
      createTray();
    }
  });

  // 监听语言变更
  useSubscribeKey(globalStore.appearance, "language", () => {
    updateTrayMenu();
  });

  useUpdateEffect(() => {
    updateTrayMenu();

    emit(LISTEN_KEY.TOGGLE_LISTEN_CLIPBOARD, startListen);
  }, [startListen]);

  // 通过 id 获取托盘图标
  const getTrayById = () => {
    return TrayIcon.getById(TRAY_ID);
  };

  // 创建托盘
  const createTray = async () => {
    if (!globalStore.app.showMenubarIcon) return;

    const tray = await getTrayById();

    if (tray) return;

    const { appName, appVersion } = globalStore.env;

    const menu = await getTrayMenu();

    const iconPath = isMac ? "assets/tray-mac.ico" : "assets/tray.ico";
    const icon = await resolveResource(iconPath);

    const options: TrayIconOptions = {
      action: (event) => {
        if (isMac) return;

        if (event.type === "Click" && event.button === "Left") {
          showWindow("main");
        }
      },
      icon,
      iconAsTemplate: false,
      id: TRAY_ID,
      menu,
      menuOnLeftClick: isMac,
      tooltip: `${appName} v${appVersion}`,
    };

    return TrayIcon.new(options);
  };

  // 获取托盘菜单
  const getTrayMenu = async () => {
    const { appVersion } = globalStore.env;

    const items = await Promise.all([
      MenuItem.new({
        accelerator: isMac ? "Cmd+," : void 0,
        action: () => showWindow("preference"),
        text: t("component.tray.label.preference"),
      }),
      MenuItem.new({
        action: triggerScreenshot,
        text: t("component.tray.label.screenshot", "截图"),
      }),
      PredefinedMenuItem.new({ item: "Separator" }),
      PredefinedMenuItem.new({ item: "Separator" }),
      MenuItem.new({
        enabled: false,
        text: `${t("component.tray.label.version")} ${appVersion}`,
      }),
      MenuItem.new({
        action: relaunch,
        text: t("component.tray.label.relaunch"),
      }),
      MenuItem.new({
        accelerator: isMac ? "Cmd+Q" : void 0,
        action: () => exit(0),
        text: t("component.tray.label.exit"),
      }),
    ]);

    return Menu.new({ items });
  };

  // 更新托盘菜单
  const updateTrayMenu = async () => {
    const tray = await getTrayById();

    if (!tray) return;

    const menu = await getTrayMenu();

    tray.setMenu(menu);
  };

  return {
    createTray,
  };
};
