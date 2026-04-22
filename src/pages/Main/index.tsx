import { useEventEmitter, useKeyPress, useMount, useReactive } from "ahooks";
import type { EventEmitter } from "ahooks/lib/useEventEmitter";
import { notification } from "antd";
import { range } from "es-toolkit";
import { find, last } from "es-toolkit/compat";
import { t } from "i18next";
import { createContext, useCallback, useRef } from "react";
import {
  startListening,
  stopListening,
  writeText,
} from "tauri-plugin-clipboard-x-api";
import { useSnapshot } from "valtio";
import Audio, { type AudioRef } from "@/components/Audio";
import { LISTEN_KEY, PRESET_SHORTCUT } from "@/constants";
import { updateHistory } from "@/database/history";
import { useClipboard } from "@/hooks/useClipboard";
import { useImmediateKey } from "@/hooks/useImmediateKey";
import { useRegister } from "@/hooks/useRegister";
import { useSubscribeKey } from "@/hooks/useSubscribeKey";
import { useTauriListen } from "@/hooks/useTauriListen";
import { type PasteResult, pasteToClipboard } from "@/plugins/clipboard";
import {
  applyMainWindowLayout,
  showToastWindow,
  showWindow,
  toggleWindowVisible,
} from "@/plugins/window";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import type {
  DatabaseSchemaGroupId,
  DatabaseSchemaHistory,
} from "@/types/database";
import type { Store } from "@/types/store";
import { formatDate } from "@/utils/dayjs";
import { touchHistoryItemInList } from "@/utils/historyActivation";
import { deepAssign } from "@/utils/object";
import { triggerScreenshotFromCursor } from "@/utils/screenshot-trigger";
import DockMode from "./components/DockMode";
import StandardMode from "./components/StandardMode";

interface EventBusPayload {
  id: string;
  action: string;
}

export interface State {
  group: DatabaseSchemaGroupId;
  search?: string;
  pinned?: boolean;
  activeId?: string;
  list: DatabaseSchemaHistory[];
  eventBus?: EventEmitter<EventBusPayload>;
  quickPasteKeys: string[];
}

const INITIAL_STATE: State = {
  group: "all",
  list: [],
  quickPasteKeys: [],
};

interface MainContextValue {
  rootState: State;
  handlePasteResult?: (result: PasteResult) => void;
  touchHistoryItem?: (data: DatabaseSchemaHistory) => void;
}

export const MainContext = createContext<MainContextValue>({
  handlePasteResult: undefined,
  rootState: INITIAL_STATE,
  touchHistoryItem: undefined,
});

const Main = () => {
  const state = useReactive<State>(INITIAL_STATE);
  const { shortcut } = useSnapshot(globalStore);
  const {
    content,
    window,
    notification: notificationStore,
  } = useSnapshot(clipboardStore);
  const eventBus = useEventEmitter<EventBusPayload>();
  const audioRef = useRef<AudioRef>(null);

  // 处理粘贴结果
  const handlePasteResult = useCallback(
    (result: PasteResult) => {
      if (result.success) {
        // 显示粘贴成功提示（使用独立窗口）
        if (notificationStore.pasteSuccess) {
          showToastWindow();
        }
      } else if (result.error === "ACCESSIBILITY_DENIED") {
        // 显示权限未授权通知
        notification.error({
          description: t(
            "notification.accessibility_denied.description",
            "请前往 系统设置 > 隐私与安全性 > 辅助功能 中授权本应用",
          ),
          duration: 5,
          message: t(
            "notification.accessibility_denied.title",
            "需要辅助功能权限",
          ),
          placement: "topRight",
        });
      }
    },
    [notificationStore.pasteSuccess, t],
  );

  const touchHistoryItem = useCallback(
    (data: DatabaseSchemaHistory) => {
      if (!content.autoSort) {
        return;
      }

      const createTime = formatDate();
      data.createTime = createTime;
      touchHistoryItemInList(state.list, data.id, createTime);
      void updateHistory(data.id, { createTime });
    },
    [content.autoSort],
  );

  useMount(() => {
    state.eventBus = eventBus;
  });

  useClipboard(state, {
    beforeRead() {
      if (!clipboardStore.audio.copy) return;

      audioRef.current?.play();
    },
  });

  // 同步配置项
  useTauriListen<Store>(LISTEN_KEY.STORE_CHANGED, ({ payload }) => {
    deepAssign(globalStore, payload.globalStore);
    deepAssign(clipboardStore, payload.clipboardStore);

    applyMainWindowLayout();
  });

  // 窗口显示与隐藏
  useRegister(toggleWindowVisible, [shortcut.clipboard]);

  // 注册截图全局快捷键
  const triggerScreenshot = useCallback(async () => {
    try {
      await triggerScreenshotFromCursor();
    } catch {
      // Screenshot shortcut failed
    }
  }, []);

  useRegister(triggerScreenshot, [shortcut.screenshot]);

  // 打开偏好设置窗口
  useKeyPress(PRESET_SHORTCUT.OPEN_PREFERENCES, () => {
    showWindow("preference");
  });

  // 设置快捷粘贴的快捷键
  const setQuickPasteKeys = () => {
    const { enable, value } = globalStore.shortcut.quickPaste;

    if (!enable) {
      state.quickPasteKeys = [];

      return;
    }

    state.quickPasteKeys = range(1, 10).map((item) => [value, item].join("+"));
  };

  // 监听快速粘贴的启用状态变更
  useImmediateKey(globalStore.shortcut.quickPaste, "enable", () => {
    setQuickPasteKeys();
  });

  // 监听快速粘贴的快捷键变更
  useSubscribeKey(globalStore.shortcut.quickPaste, "value", () => {
    setQuickPasteKeys();
  });

  // 切换剪贴板监听状态
  useTauriListen<boolean>(LISTEN_KEY.TOGGLE_LISTEN_CLIPBOARD, ({ payload }) => {
    if (payload) {
      startListening();
    } else {
      stopListening();
    }
  });

  // 监听粘贴为纯文本的快捷键
  useKeyPress(shortcut.pastePlain, async (event) => {
    event.preventDefault();

    const data = find(state.list, { id: state.activeId });

    if (!data) return;

    const result = await pasteToClipboard(data, true);
    handlePasteResult(result);
    if (result.success) {
      touchHistoryItem(data);
    }
  });

  // 监听复制文件路径的快捷键
  useKeyPress(shortcut.copyFilePath, (event) => {
    event.preventDefault();

    const data = find(state.list, { id: state.activeId });

    if (!data) return;

    const { type, value } = data;

    let filePath: string | undefined;

    if (type === "image") {
      filePath = value;
    } else if (type === "files") {
      const paths = Array.isArray(value) ? value : JSON.parse(value);
      filePath = paths.join("\n");
    }

    if (filePath) {
      writeText(filePath);
    }
  });

  // 监听快速粘贴的快捷键
  useRegister(
    async (event) => {
      if (!globalStore.shortcut.quickPaste.enable) return;

      const index = Number(last(event.shortcut));

      const data = state.list[index - 1];

      const result = await pasteToClipboard(data);
      handlePasteResult(result);
      if (result.success) {
        touchHistoryItem(data);
      }
    },
    [state.quickPasteKeys],
  );

  return (
    <MainContext.Provider
      value={{
        handlePasteResult,
        rootState: state,
        touchHistoryItem,
      }}
    >
      <Audio ref={audioRef} />

      {window.style === "standard" ? <StandardMode /> : <DockMode />}
    </MainContext.Provider>
  );
};

export default Main;
