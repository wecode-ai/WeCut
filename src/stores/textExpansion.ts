import { emit } from "@tauri-apps/api/event";
import { proxy } from "valtio";
import {
  checkTriggerWordExists,
  deleteTextExpansion,
  insertTextExpansion,
  selectTextExpansions,
  updateTextExpansion,
} from "@/database/textExpansion";
import {
  setTextExpansionEnabled,
  setTextExpansionPrefix,
  setTextExpansions,
} from "@/plugins/textExpansion";
import type { DatabaseSchemaTextExpansion } from "@/types/database";

const TEXT_EXPANSION_CHANGED = "text-expansion:changed";

export interface TextExpansionState {
  expansions: DatabaseSchemaTextExpansion[];
  isLoading: boolean;
  prefix: string;
  enabled: boolean;
}

export const textExpansionStore = proxy<TextExpansionState>({
  enabled: true,
  expansions: [],
  isLoading: false,
  prefix: ";;",
});

// Check for prefix conflicts
// Returns the conflicting trigger word if found, null otherwise
function checkPrefixConflict(
  triggerWord: string,
  excludeId?: string,
): string | null {
  const { expansions } = textExpansionStore;

  for (const exp of expansions) {
    if (excludeId && exp.id === excludeId) continue;

    // Check if new trigger is a prefix of existing trigger
    if (exp.triggerWord.startsWith(triggerWord)) {
      return exp.triggerWord;
    }

    // Check if existing trigger is a prefix of new trigger
    if (triggerWord.startsWith(exp.triggerWord)) {
      return exp.triggerWord;
    }
  }

  return null;
}

export const textExpansionActions = {
  async addExpansion(
    triggerWord: string,
    content: string,
    sourceHistoryId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const exists = await checkTriggerWordExists(triggerWord);
    if (exists) {
      return { error: "该快捷词已存在", success: false };
    }

    // Check prefix conflicts
    const conflict = checkPrefixConflict(triggerWord);
    if (conflict) {
      return {
        error: `与现有快捷词 "${conflict}" 存在前缀冲突`,
        success: false,
      };
    }

    await insertTextExpansion({
      content,
      sourceHistoryId,
      triggerWord,
    });

    await this.loadExpansions();
    // Notify other windows
    await emit(TEXT_EXPANSION_CHANGED);
    return { success: true };
  },

  async deleteExpansion(id: string): Promise<void> {
    await deleteTextExpansion(id);
    await this.loadExpansions();
    // Notify other windows
    await emit(TEXT_EXPANSION_CHANGED);
  },
  async loadExpansions() {
    textExpansionStore.isLoading = true;
    try {
      textExpansionStore.expansions = await selectTextExpansions();
      // Sync to Rust after loading
      await this.syncToRust();
    } finally {
      textExpansionStore.isLoading = false;
    }
  },

  setEnabled(enabled: boolean) {
    textExpansionStore.enabled = enabled;
    // Sync to Rust immediately
    setTextExpansionEnabled(enabled);
  },

  setPrefix(prefix: string) {
    textExpansionStore.prefix = prefix;
    // Sync to Rust immediately
    setTextExpansionPrefix(prefix);
  },

  async syncToRust() {
    const { prefix, enabled, expansions } = textExpansionStore;

    // Convert expansions array to Record<triggerWord, content>
    const expansionMap: Record<string, string> = {};
    for (const exp of expansions) {
      expansionMap[exp.triggerWord] = exp.content;
    }

    await setTextExpansionEnabled(enabled);
    await setTextExpansionPrefix(prefix);
    await setTextExpansions(expansionMap);
  },

  async updateExpansion(
    id: string,
    triggerWord: string,
    content: string,
  ): Promise<{ success: boolean; error?: string }> {
    const exists = await checkTriggerWordExists(triggerWord, id);
    if (exists) {
      return { error: "该快捷词已存在", success: false };
    }

    // Check prefix conflicts
    const conflict = checkPrefixConflict(triggerWord, id);
    if (conflict) {
      return {
        error: `与现有快捷词 "${conflict}" 存在前缀冲突`,
        success: false,
      };
    }

    await updateTextExpansion(id, {
      content,
      triggerWord,
    });

    await this.loadExpansions();
    // Notify other windows
    await emit(TEXT_EXPANSION_CHANGED);
    return { success: true };
  },
};

// 初始化加载快捷粘贴列表（由 App.tsx 在 restoreStore 完成后调用）
// textExpansionActions.loadExpansions();
