import { emit } from "@tauri-apps/api/event";
import { useCreation, useMount } from "ahooks";
import { Flex } from "antd";
import clsx from "clsx";
import { MacScrollbar } from "mac-scrollbar";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import UnoIcon from "@/components/UnoIcon";
import UpdateApp from "@/components/UpdateApp";
import { LISTEN_KEY } from "@/constants";
import { useRegister } from "@/hooks/useRegister";
import { useSubscribe } from "@/hooks/useSubscribe";
import { useTray } from "@/hooks/useTray";
import { isAutostart } from "@/plugins/autostart";
import { showWindow, toggleWindowVisible } from "@/plugins/window";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import { raf } from "@/utils/bom";
import { isMac } from "@/utils/is";
import { saveStore } from "@/utils/store";
import About from "./components/About";
import AiSend from "./components/AiSend";
import Clipboard from "./components/Clipboard";
import General from "./components/General";
import History from "./components/History";
import Privacy from "./components/Privacy";
import Shortcut from "./components/Shortcut";
import TagManager from "./components/TagManager";
import TextExpansion from "./components/TextExpansion";

const Preference = () => {
  const { t } = useTranslation();
  const { app, shortcut, appearance } = useSnapshot(globalStore);
  const [activeKey, setActiveKey] = useState("clipboard");
  const contentRef = useRef<HTMLElement>(null);

  const { createTray } = useTray();

  useMount(async () => {
    createTray();

    const autostart = await isAutostart();

    if (!autostart && !app.silentStart) {
      showWindow();
    }
  });

  // 监听全局配置项变化
  useSubscribe(globalStore, () => handleStoreChanged());

  // 监听剪贴板配置项变化
  useSubscribe(clipboardStore, () => handleStoreChanged());

  // 监听快捷键切换窗口显隐
  useRegister(toggleWindowVisible, [shortcut.preference]);

  // 配置项变化通知其它窗口和本地存储
  const handleStoreChanged = () => {
    emit(LISTEN_KEY.STORE_CHANGED, { clipboardStore, globalStore });

    saveStore();
  };

  const menuItems = useCreation(() => {
    const items = [
      {
        content: <Clipboard />,
        icon: "i-lucide:clipboard-list",
        key: "clipboard",
        label: t("preference.menu.title.clipboard"),
      },
      {
        content: <History />,
        icon: "i-lucide:history",
        key: "history",
        label: t("preference.menu.title.history"),
      },
      {
        content: <General />,
        icon: "i-lucide:bolt",
        key: "general",
        label: t("preference.menu.title.general"),
      },
      {
        content: <Shortcut />,
        icon: "i-lucide:keyboard",
        key: "shortcut",
        label: t("preference.menu.title.shortcut"),
      },
    ];

    items.push(
      {
        content: <TagManager />,
        icon: "i-lucide:tag",
        key: "tag",
        label: t("preference.menu.title.tag", "标签管理"),
      },
      {
        content: <TextExpansion />,
        icon: "i-lucide:text-cursor-input",
        key: "textExpansion",
        label: t("preference.text_expansion.title"),
      },
      // {
      //   content: <Backup />,
      //   icon: "i-lucide:database-backup",
      //   key: "backup",
      //   label: t("preference.menu.title.backup"),
      // },
      {
        content: <AiSend />,
        icon: "i-lucide:send",
        key: "wegent",
        label: t("preference.menu.title.wegent", "Wegent集成"),
      },
      {
        content: <Privacy />,
        icon: "i-lucide:shield",
        key: "privacy",
        label: t("preference.menu.title.privacy"),
      },
      {
        content: <About />,
        icon: "i-lucide:info",
        key: "about",
        label: t("preference.menu.title.about"),
      },
    );

    return items;
  }, [appearance.language]);

  const handleMenuClick = (key: string) => {
    setActiveKey(key);

    raf(() => {
      contentRef.current?.scrollTo({ behavior: "smooth", top: 0 });
    });
  };

  return (
    <Flex className="h-screen">
      <Flex
        className={clsx("h-full w-50 overflow-y-auto p-2", [
          isMac ? "pt-8" : "bg-color-1",
        ])}
        data-tauri-drag-region
        gap={6}
        vertical
      >
        {menuItems.map((item) => {
          const { key, label, icon } = item;

          return (
            <Flex
              align="center"
              className={clsx(
                "cursor-pointer rounded-lg px-3 py-2 text-color-2 transition hover:bg-color-4",
                {
                  "bg-primary! text-white!": activeKey === key,
                },
              )}
              gap="small"
              key={key}
              onClick={() => handleMenuClick(key)}
            >
              <UnoIcon name={icon} size={18} />

              <span className="font-bold text-sm">{label}</span>
            </Flex>
          );
        })}
      </Flex>

      <MacScrollbar
        className="h-full flex-1 bg-color-2 p-4"
        data-tauri-drag-region
        ref={contentRef}
        skin={appearance.isDark ? "dark" : "light"}
      >
        {menuItems.map((item) => {
          const { key, content } = item;

          return (
            <div hidden={key !== activeKey} key={key}>
              {content}
            </div>
          );
        })}
      </MacScrollbar>

      <UpdateApp />
    </Flex>
  );
};

export default Preference;
