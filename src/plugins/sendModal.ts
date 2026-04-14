import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LISTEN_KEY, WINDOW_LABEL } from "@/constants";
import type { DatabaseSchemaHistory } from "@/types/database";

const COMMAND = {
  CLOSE_SEND_MODAL_WINDOW: "plugin:eco-window|close_send_modal_window",
  HIDE_SEND_MODAL_WINDOW: "plugin:eco-window|hide_send_modal_window",
  SHOW_SEND_MODAL_WINDOW: "plugin:eco-window|show_send_modal_window",
};

// 全局状态，用于在窗口间共享当前要发送的 item
let currentSendItem: DatabaseSchemaHistory | null = null;

export interface SendModalData {
  itemId: string;
  itemType: string;
  serviceType: string;
  value?: string | string[];
}

export interface SendModalPayload {
  extraMessage?: string;
  title?: string;
  note?: string;
  priority?: "normal" | "high" | "low";
  senderExternalId?: string;
  senderDisplayName?: string;
  sourceType?: string;
  sourceName?: string;
}

/**
 * 设置当前要发送的 item（在主窗口中调用）
 */
export const setCurrentSendItem = (item: DatabaseSchemaHistory | null) => {
  currentSendItem = item;
};

/**
 * 获取当前要发送的 item（在 SendModal 窗口中调用）
 */
export const getCurrentSendItem = (): DatabaseSchemaHistory | null => {
  // 首先尝试从 localStorage 获取（用于跨窗口访问）
  const stored = localStorage.getItem("sendModalItem");
  if (stored) {
    try {
      const item = JSON.parse(stored) as DatabaseSchemaHistory;
      return item;
    } catch {
      // 解析失败时回退到全局变量
    }
  }
  // 回退到全局变量
  return currentSendItem;
};

/**
 * 显示 SendModal 窗口
 */
export const showSendModalWindow = async (
  item: DatabaseSchemaHistory,
  serviceType: string,
) => {
  // 保存当前 item 到全局状态
  currentSendItem = item;
  // 将 item 存储到 localStorage，以便 SendModal 窗口可以访问
  localStorage.setItem("sendModalItem", JSON.stringify(item));
  await invoke(COMMAND.SHOW_SEND_MODAL_WINDOW, {
    itemId: item.id,
    itemType: item.type,
    serviceType,
  });
};

/**
 * 隐藏 SendModal 窗口
 */
export const hideSendModalWindow = async () => {
  await invoke(COMMAND.HIDE_SEND_MODAL_WINDOW);
};

/**
 * 关闭 SendModal 窗口
 */
export const closeSendModalWindow = async () => {
  await invoke(COMMAND.CLOSE_SEND_MODAL_WINDOW);
};

/**
 * 监听 SendModal 数据事件（在 SendModal 窗口中调用）
 */
export const listenSendModalData = (
  callback: (data: SendModalData) => void,
) => {
  return listen<SendModalData>(LISTEN_KEY.SEND_MODAL_DATA, (event) => {
    callback(event.payload);
  });
};

/**
 * 发送 SendModal 发送事件（通知主窗口执行发送）
 */
export const emitSendModalSend = async (payload: SendModalPayload) => {
  await emit(LISTEN_KEY.SEND_MODAL_SEND, payload);
};

/**
 * 监听 SendModal 发送事件（在主窗口中调用）
 */
export const listenSendModalSend = (
  callback: (payload: SendModalPayload) => void,
) => {
  return listen<SendModalPayload>(LISTEN_KEY.SEND_MODAL_SEND, (event) => {
    callback(event.payload);
  });
};

/**
 * 关闭当前 SendModal 窗口（在 SendModal 窗口内部调用）
 */
export const closeCurrentSendModal = async () => {
  const window = getCurrentWebviewWindow();
  if (window.label === WINDOW_LABEL.SEND_MODAL) {
    await window.close();
  }
};

/**
 * 隐藏当前 SendModal 窗口（在 SendModal 窗口内部调用）
 */
export const hideCurrentSendModal = async () => {
  const window = getCurrentWebviewWindow();
  if (window.label === WINDOW_LABEL.SEND_MODAL) {
    await window.hide();
  }
};
