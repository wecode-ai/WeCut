import { proxy } from "valtio";
import {
  addTagToHistory,
  createTag,
  deleteTag,
  removeTagFromHistory,
  selectTags,
  updateTag,
} from "@/database/tag";
import type { DatabaseSchemaTag } from "@/types/database";
import type { ClipboardStore } from "@/types/store";
import { DEFAULTS } from "@/utils/envConfig";

export const clipboardStore = proxy<ClipboardStore>({
  activeTagId: null,

  // AI Chat (OpenAI) 配置 (旧配置，保留用于迁移)
  aiChatConfig: {
    apiKey: "",
    baseUrl: DEFAULTS.AI_CHAT_URL,
    customHeaders: {},
    model: DEFAULTS.AI_MODEL,
  },

  // AI 发送基础配置 (旧配置，保留用于迁移)
  aiSend: {
    enabled: true,
    serviceType: "aiChat",
    showInUI: true,
  },

  audio: {
    copy: false,
  },

  content: {
    activateAction: "paste",
    autoFavorite: false,
    autoPaste: "double",
    autoSort: false,
    copyPlain: false,
    deleteConfirm: true,
    operationButtons: ["copy", "send", "star", "delete"],
    pastePlain: false,
    showOriginalContent: false,
  },

  history: {
    duration: 0,
    maxCount: 0,
    unit: 1,
  },

  notification: {
    pasteSuccess: true,
  },

  search: {
    autoClear: false,
    defaultFocus: false,
    position: "top",
  },

  // 标签系统
  tags: [],

  // UI 状态持久化
  ui: {
    activeTagId: null,
  },

  // Wegent 集成配置 (新配置)
  wegent: {
    aiChat: {
      apiKey: "",
      baseUrl: DEFAULTS.AI_CHAT_URL,
      customHeaders: {},
      enabled: true,
      model: DEFAULTS.AI_MODEL,
    },
    workQueue: {
      apiToken: "",
      baseUrl: DEFAULTS.WORK_QUEUE_URL,
      defaults: {
        note: "",
        title: "",
      },
      enabled: false,
      queueName: "",
    },
  },
  window: {
    backTop: false,
    dockScale: 0.75,
    position: "remember",
    rememberActiveId: false,
    showAll: false,
    style: "dock",
  },

  // Work Queue 配置 (旧配置，保留用于迁移)
  workQueueConfig: {
    apiToken: "",
    baseUrl: DEFAULTS.WORK_QUEUE_URL,
    defaults: {
      note: "",
      title: "",
    },
    queueName: "",
  },
});

// 标签操作
export const tagActions = {
  async addTagToHistory(historyId: string, tagId: string) {
    await addTagToHistory(historyId, tagId);
  },

  async create(name: string, color: string) {
    const tag = await createTag({ color, name });
    await tagActions.loadTags();
    return tag;
  },

  async delete(id: string) {
    await deleteTag(id);
    await tagActions.loadTags();
    // 如果删除的是当前激活的标签，重置为 null
    if (clipboardStore.activeTagId === id) {
      clipboardStore.activeTagId = null;
      clipboardStore.ui.activeTagId = null;
    }
  },
  async loadTags() {
    const tags = await selectTags();
    clipboardStore.tags = tags;
  },

  async removeTagFromHistory(historyId: string, tagId: string) {
    await removeTagFromHistory(historyId, tagId);
  },

  setActiveTag(tagId: string | null) {
    clipboardStore.activeTagId = tagId;
    clipboardStore.ui.activeTagId = tagId;
  },

  async update(
    id: string,
    updates: Partial<Pick<DatabaseSchemaTag, "name" | "color">>,
  ) {
    await updateTag(id, updates);
    await tagActions.loadTags();
  },
};

// 初始化加载标签（由 App.tsx 在 restoreStore 完成后调用）
// tagActions.loadTags();
