import type { InputRef } from "antd";
import { Modal } from "antd";
import clsx from "clsx";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import { LISTEN_KEY } from "@/constants";
import { useShortcut, useShortcutAction } from "@/contexts/ShortcutContext";
import { useHistoryList } from "@/hooks/useHistoryList";
import { useTauriFocus } from "@/hooks/useTauriFocus";
import { setCurrentSendItem, showSendModalWindow } from "@/plugins/sendModal";
import { hideWindow } from "@/plugins/window";
import { getDockContentHeight } from "@/plugins/window-layout";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import type { DatabaseSchemaHistory } from "@/types/database";
import { MainContext } from "../..";
import NoteModal, {
  type NoteModalRef,
} from "../HistoryList/components/NoteModal";
import DockCardRail from "./components/DockCardRail";
import DockToolbar from "./components/DockToolbar";

const DockMode = () => {
  const { rootState } = useContext(MainContext);
  const { shortcut, env } = useSnapshot(globalStore);
  const { wegent, aiSend } = useSnapshot(clipboardStore);
  const [searchActive, setSearchActive] = useState(Boolean(rootState.search));
  const [frozenItems, setFrozenItems] = useState<
    DatabaseSchemaHistory[] | null
  >(null);

  // WegentChat 是否显示（由环境变量控制）
  const wegentChatEnabled = env.features?.wegentChat ?? false;
  const noteModalRef = useRef<NoteModalRef>(null);
  const searchInputRef = useRef<InputRef>(null);
  const dockContainerRef = useRef<HTMLDivElement>(null);
  const [deleteModal, contextHolder] = Modal.useModal();
  const { popContext } = useShortcut();

  const scrollToStart = () => {
    const firstItem = rootState.list[0];

    if (!firstItem) return;

    rootState.activeId = firstItem.id;
  };

  const freezeVisibleItems = useCallback(() => {
    setFrozenItems([...rootState.list]);
  }, [rootState]);

  const releaseVisibleItems = useCallback(() => {
    setFrozenItems(null);
  }, []);

  const { loadMore } = useHistoryList({
    scrollToTop: scrollToStart,
  });

  useEffect(() => {
    if (rootState.search) {
      setSearchActive(true);
      return;
    }

    if (document.activeElement === searchInputRef.current?.input) return;

    setSearchActive(false);
  }, [rootState.search]);

  // Navigation shortcuts
  useShortcutAction(
    "dock-select-left",
    "arrowleft",
    () => {
      const { list, activeId } = rootState;
      const currentIndex = list.findIndex((item) => item.id === activeId);
      if (currentIndex > 0) {
        rootState.activeId = list[currentIndex - 1].id;
      }
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-right",
    "arrowright",
    () => {
      const { list, activeId } = rootState;
      const currentIndex = list.findIndex((item) => item.id === activeId);
      if (currentIndex >= 0 && currentIndex < list.length - 1) {
        rootState.activeId = list[currentIndex + 1].id;
      }
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-jump-start",
    "home",
    () => {
      const { list } = rootState;
      if (list.length > 0) {
        rootState.activeId = list[0].id;
      }
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-jump-end",
    "end",
    () => {
      const { list } = rootState;
      if (list.length > 0) {
        rootState.activeId = list[list.length - 1].id;
      }
    },
    { context: "normal", priority: 10 },
  );

  // Number keys 1-9 for quick selection
  useShortcutAction(
    "dock-select-1",
    "1",
    () => {
      const { list } = rootState;
      if (list[0]) rootState.activeId = list[0].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-2",
    "2",
    () => {
      const { list } = rootState;
      if (list[1]) rootState.activeId = list[1].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-3",
    "3",
    () => {
      const { list } = rootState;
      if (list[2]) rootState.activeId = list[2].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-4",
    "4",
    () => {
      const { list } = rootState;
      if (list[3]) rootState.activeId = list[3].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-5",
    "5",
    () => {
      const { list } = rootState;
      if (list[4]) rootState.activeId = list[4].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-6",
    "6",
    () => {
      const { list } = rootState;
      if (list[5]) rootState.activeId = list[5].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-7",
    "7",
    () => {
      const { list } = rootState;
      if (list[6]) rootState.activeId = list[6].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-8",
    "8",
    () => {
      const { list } = rootState;
      if (list[7]) rootState.activeId = list[7].id;
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-select-9",
    "9",
    () => {
      const { list } = rootState;
      if (list[8]) rootState.activeId = list[8].id;
    },
    { context: "normal", priority: 10 },
  );

  // Action shortcuts
  useShortcutAction(
    "dock-preview",
    " ",
    () => {
      const { activeId, eventBus } = rootState;
      if (activeId) {
        eventBus?.emit({
          action: LISTEN_KEY.CLIPBOARD_ITEM_PREVIEW,
          id: activeId,
        });
      }
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-delete",
    "delete",
    () => {
      const { activeId, eventBus } = rootState;
      if (activeId) {
        eventBus?.emit({
          action: LISTEN_KEY.CLIPBOARD_ITEM_DELETE,
          id: activeId,
        });
      }
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "dock-delete-backspace",
    "backspace",
    () => {
      const { activeId, eventBus } = rootState;
      if (activeId) {
        eventBus?.emit({
          action: LISTEN_KEY.CLIPBOARD_ITEM_DELETE,
          id: activeId,
        });
      }
    },
    { context: "normal", priority: 10 },
  );

  // Search shortcuts
  useShortcutAction(
    "dock-focus-search",
    "cmd.f",
    () => {
      setSearchActive(true);
      queueMicrotask(() => {
        searchInputRef.current?.focus();
      });
    },
    { context: "normal", priority: 20 },
  );

  useShortcutAction(
    "dock-quick-search",
    "/",
    () => {
      setSearchActive(true);
      queueMicrotask(() => {
        searchInputRef.current?.focus();
      });
    },
    { context: "normal", priority: 20 },
  );

  useShortcutAction(
    "dock-cancel-search",
    "escape",
    () => {
      // 分层退出逻辑：
      // 1. 如果有输入框/文本域/可编辑元素有焦点 → 先失焦（保留 Dock 打开）
      // 2. 如果搜索有内容 → 清空搜索
      // 3. 如果搜索框激活 → 关闭搜索框
      // 4. 否则 → 隐藏 Dock
      const activeElement = document.activeElement as HTMLElement | null;

      // 检查焦点是否在输入框、文本域或可编辑元素内
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable)
      ) {
        // 失焦，但保持 Dock 打开
        activeElement.blur();
        // 立即更新上下文栈，让 normal 快捷键能正常工作
        popContext("input");
        return;
      }

      if (rootState.search) {
        rootState.search = undefined;
        return;
      }

      if (searchActive) {
        setSearchActive(false);
        return;
      }

      // L1 → L0: 隐藏 Dock
      hideWindow();
    },
    { context: "input", priority: 30 },
  );

  // 回车键：在输入框内则失焦，否则粘贴
  useShortcutAction(
    "dock-enter",
    "enter",
    () => {
      const activeElement = document.activeElement as HTMLElement | null;

      // 如果焦点在搜索输入框内，失焦并更新上下文
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable)
      ) {
        activeElement.blur();
        // 立即更新上下文栈，让后续的 normal 快捷键能正常工作
        popContext("input");
        return;
      }

      // 不在输入框内，执行粘贴
      const { activeId, eventBus } = rootState;
      if (activeId) {
        eventBus?.emit({
          action: LISTEN_KEY.CLIPBOARD_ITEM_PASTE,
          id: activeId,
        });
      }
    },
    { context: "input", priority: 35 },
  );

  // User-configured send shortcuts
  const handleDockSend = (serviceType: "aiChat" | "workQueue") => {
    const { activeId, list } = rootState;
    if (activeId) {
      const item = list.find((i) => i.id === activeId);
      if (item) {
        setCurrentSendItem(item as DatabaseSchemaHistory);
        showSendModalWindow(item as DatabaseSchemaHistory, serviceType).catch(
          (_err) => {},
        );
      }
    }
  };

  // Cmd+Enter: quick send active item to inbox (open send modal)
  useShortcutAction(
    "dock-send-to-inbox",
    "meta.enter",
    () => {
      handleDockSend("workQueue");
    },
    { context: "normal", priority: 20 },
  );

  // WegentChat 快捷键仅在环境变量开启时注册
  useShortcutAction(
    "dock-send-to-ai-chat",
    wegentChatEnabled ? shortcut.wegent?.aiChat : "",
    () => handleDockSend("aiChat"),
    { context: "normal", priority: 15 },
  );

  useShortcutAction(
    "dock-send-to-work-queue",
    shortcut.wegent?.workQueue,
    () => handleDockSend("workQueue"),
    { context: "normal", priority: 15 },
  );

  // Backward compatibility for old send shortcut
  useShortcutAction(
    "dock-send-to-ai",
    shortcut.send,
    () => {
      // 确定服务类型：如果只有一个启用，使用该服务；否则使用 aiChat
      let serviceType: "aiChat" | "workQueue" = "aiChat";
      if (
        wegentChatEnabled &&
        wegent?.aiChat?.enabled &&
        !wegent?.workQueue?.enabled
      ) {
        serviceType = "aiChat";
      } else if (!wegent?.aiChat?.enabled && wegent?.workQueue?.enabled) {
        serviceType = "workQueue";
      } else if (wegentChatEnabled) {
        serviceType = aiSend?.serviceType || "aiChat";
      } else {
        serviceType = "workQueue";
      }
      handleDockSend(serviceType);
    },
    { context: "normal", priority: 15 },
  );

  const { window: windowConfig } = useSnapshot(clipboardStore);

  const scale = windowConfig.dockScale;

  // 设置 CSS 变量到 html 元素，供子组件读取
  useEffect(() => {
    document.documentElement.style.setProperty("--dock-scale", String(scale));
  }, [scale]);

  useTauriFocus({
    onBlur() {
      hideWindow();
    },
    onFocus() {
      releaseVisibleItems();
      if (!windowConfig.rememberActiveId) {
        scrollToStart();
      }
      // 窗口获得焦点时，将焦点设置到 Dock 容器以确保键盘事件能正常接收
      queueMicrotask(() => {
        dockContainerRef.current?.focus();
      });
    },
  });

  // 全局键盘输入监听：任意可打印字符触发搜索
  useEffect(() => {
    let isComposing = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果搜索已激活，不处理
      if (searchActive) return;

      // 如果焦点在输入元素上（如标签编辑输入框），不劫持按键
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // 如果正在使用输入法组合，不处理
      if (isComposing) return;

      // 忽略有修饰键的组合（除了 Shift，因为 Shift + 字母也是输入）
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // 忽略功能键
      const ignoreKeys = [
        "Escape",
        "Enter",
        "Tab",
        "Backspace",
        "Delete",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "F1",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "F7",
        "F8",
        "F9",
        "F10",
        "F11",
        "F12",
      ];
      if (ignoreKeys.includes(event.key)) return;

      // 检查是否是可打印字符（单个字符且不是控制字符）
      if (event.key.length === 1) {
        event.preventDefault();
        event.stopPropagation();

        // 激活搜索框
        setSearchActive(true);

        // 将输入的字符填入搜索框
        const char = event.key;
        const newSearch = (rootState.search || "") + char;
        rootState.search = newSearch;

        // 聚焦搜索框
        queueMicrotask(() => {
          searchInputRef.current?.focus();
        });
      }
    };

    const handleCompositionStart = () => {
      isComposing = true;
    };

    const handleCompositionEnd = (event: CompositionEvent) => {
      isComposing = false;

      // 如果焦点在输入元素上，不劫持输入法结果
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // 如果搜索未激活，且输入法输入了内容，激活搜索
      if (!searchActive && event.data) {
        setSearchActive(true);
        const newSearch = (rootState.search || "") + event.data;
        rootState.search = newSearch;

        queueMicrotask(() => {
          searchInputRef.current?.focus();
        });
      }
    };

    // 使用 capture 阶段确保在其他处理器之前捕获
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("compositionstart", handleCompositionStart, true);
    window.addEventListener("compositionend", handleCompositionEnd, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener(
        "compositionstart",
        handleCompositionStart,
        true,
      );
      window.removeEventListener("compositionend", handleCompositionEnd, true);
    };
  }, [searchActive, rootState.search]);

  const totalHeight = getDockContentHeight(scale);
  const railItems = frozenItems ?? rootState.list;

  return (
    <div
      className={clsx(
        "flex flex-col gap-2 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_35%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.98))] p-2",
      )}
      ref={dockContainerRef}
      style={{ height: totalHeight }}
      tabIndex={-1}
    >
      <DockToolbar
        group={rootState.group}
        onGroupChange={(group) => {
          rootState.group = group;
        }}
        onSearchActiveChange={setSearchActive}
        onSearchChange={(value) => {
          rootState.search = value;
        }}
        search={rootState.search}
        searchActive={searchActive}
        searchInputRef={searchInputRef}
      />

      <DockCardRail
        activeId={rootState.activeId}
        afterHide={releaseVisibleItems}
        beforeActivate={freezeVisibleItems}
        deleteModal={deleteModal}
        hasFilters={Boolean(rootState.search) || rootState.group !== "all"}
        items={railItems}
        onActiveChange={(id) => {
          rootState.activeId = id;
        }}
        onLoadMore={loadMore}
        onNote={(id) => {
          noteModalRef.current?.open(id);
        }}
        onResetFilters={() => {
          rootState.group = "all";
          rootState.search = void 0;
          setSearchActive(false);
        }}
        onSend={(id, serviceType) => {
          const item = rootState.list.find((i) => i.id === id);
          if (item) {
            setCurrentSendItem(item as DatabaseSchemaHistory);
            // 确定服务类型：优先使用传入的参数，其次根据启用的服务决定
            let targetServiceType: "aiChat" | "workQueue";
            if (serviceType) {
              targetServiceType = serviceType;
            } else if (
              wegentChatEnabled &&
              wegent?.aiChat?.enabled &&
              !wegent?.workQueue?.enabled
            ) {
              targetServiceType = "aiChat";
            } else if (!wegent?.aiChat?.enabled && wegent?.workQueue?.enabled) {
              targetServiceType = "workQueue";
            } else if (wegentChatEnabled) {
              targetServiceType = aiSend?.serviceType || "aiChat";
            } else {
              targetServiceType = "workQueue";
            }
            showSendModalWindow(
              item as DatabaseSchemaHistory,
              targetServiceType,
            ).catch((_err) => {});
          }
        }}
      />

      <NoteModal ref={noteModalRef} />
      {contextHolder}
    </div>
  );
};

export default DockMode;
