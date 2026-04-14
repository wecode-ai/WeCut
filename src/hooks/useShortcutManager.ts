import { useCallback, useEffect, useRef } from "react";
import {
  matchesShortcut,
  type ParsedShortcut,
  parseShortcut,
} from "@/utils/shortcut";

export type ShortcutContext = "normal" | "search" | "input" | "modal";

export interface ShortcutAction {
  id: string;
  shortcut: string;
  parsedShortcut: ParsedShortcut | null;
  context: ShortcutContext;
  priority: number;
  handler: (event: KeyboardEvent) => undefined | boolean;
  description?: string;
}

interface ShortcutManagerState {
  actions: Map<string, ShortcutAction>;
  contextStack: ShortcutContext[];
}

// Context priority (higher = more specific, takes precedence)
const CONTEXT_PRIORITY: Record<ShortcutContext, number> = {
  input: 80,
  modal: 100,
  normal: 0,
  search: 60,
};

// Default shortcuts that can be customized
export const DEFAULT_SHORTCUTS = {
  // Actions
  ACTIVATE_ITEM: {
    context: "normal" as const,
    id: "activate-item",
    shortcut: "enter",
  },
  DELETE_ITEM: {
    context: "normal" as const,
    id: "delete-item",
    shortcut: "delete",
  },
  FAVORITE_ITEM: {
    // User configured
    context: "normal" as const,
    id: "favorite-item",
    shortcut: "",
  },

  // Search
  FOCUS_SEARCH: {
    context: "normal" as const,
    id: "focus-search",
    shortcut: "cmd.f",
  },
  JUMP_TO_END: {
    context: "normal" as const,
    id: "jump-end",
    shortcut: "end",
  },
  JUMP_TO_START: {
    context: "normal" as const,
    id: "jump-start",
    shortcut: "home",
  },
  PREVIEW_ITEM: {
    context: "normal" as const,
    id: "preview-item",
    shortcut: " ",
  },
  SELECT_LEFT: {
    context: "normal" as const,
    id: "select-left",
    shortcut: "arrowleft",
  },
  // Navigation
  SELECT_NEXT: {
    context: "normal" as const,
    id: "select-next",
    shortcut: "arrowdown",
  },
  SELECT_PREV: {
    context: "normal" as const,
    id: "select-prev",
    shortcut: "arrowup",
  },
  SELECT_RIGHT: {
    context: "normal" as const,
    id: "select-right",
    shortcut: "arrowright",
  },

  // Send to AI
  SEND_TO_AI: {
    // User configured
    context: "normal" as const,
    id: "send-to-ai",
    shortcut: "",
  },
};

export function useShortcutManager() {
  const stateRef = useRef<ShortcutManagerState>({
    actions: new Map(),
    contextStack: ["normal"],
  });

  const getCurrentContext = useCallback((): ShortcutContext => {
    const stack = stateRef.current.contextStack;
    return stack[stack.length - 1] || "normal";
  }, []);

  const pushContext = useCallback((context: ShortcutContext) => {
    stateRef.current.contextStack.push(context);
  }, []);

  const popContext = useCallback((context: ShortcutContext) => {
    const stack = stateRef.current.contextStack;
    const index = stack.lastIndexOf(context);
    if (index > -1) {
      stack.splice(index, 1);
    }
    // Ensure we always have at least "normal"
    if (stack.length === 0) {
      stack.push("normal");
    }
  }, []);

  const registerAction = useCallback(
    (action: Omit<ShortcutAction, "parsedShortcut">) => {
      const parsedShortcut = parseShortcut(action.shortcut);

      // Don't register if shortcut is empty
      if (!parsedShortcut && action.shortcut) {
        return () => {};
      }

      const fullAction: ShortcutAction = {
        ...action,
        parsedShortcut,
      };

      stateRef.current.actions.set(action.id, fullAction);

      // Return unregister function
      return () => {
        stateRef.current.actions.delete(action.id);
      };
    },
    [],
  );

  const updateShortcut = useCallback(
    (actionId: string, newShortcut: string) => {
      const action = stateRef.current.actions.get(actionId);
      if (!action) return;

      const parsedShortcut = parseShortcut(newShortcut);
      action.shortcut = newShortcut;
      action.parsedShortcut = parsedShortcut;
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const currentContext = getCurrentContext();
      const actions = Array.from(stateRef.current.actions.values());

      // 检查焦点是否在弹窗、表单元素或可编辑元素内
      const activeElement = document.activeElement;
      const isFocusInModal =
        activeElement?.closest(
          ".ant-modal, .ant-modal-root, [role='dialog']",
        ) !== null;
      const isFocusInForm =
        activeElement?.matches(
          "input, textarea, select, [contenteditable='true']",
        ) ?? false;
      const isFocusInButton = activeElement?.matches("button") ?? false;

      // 检查是否是组合键（有修饰键）
      const isComboKey =
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

      // Find matching actions for current context
      const matches = actions.filter((action) => {
        if (!action.parsedShortcut) return false;

        // Check if action's context is active or less specific
        const actionContextPriority = CONTEXT_PRIORITY[action.context];
        const currentContextPriority = CONTEXT_PRIORITY[currentContext];

        // Action only fires if its context priority >= current context priority
        // OR if it's in the exact same context
        if (
          actionContextPriority < currentContextPriority &&
          action.context !== currentContext
        ) {
          return false;
        }

        // 如果焦点在弹窗内，只处理 modal 上下文的快捷键
        // 但组合键（如 Option+Enter）始终允许通过
        if (
          isFocusInModal &&
          action.context !== "modal" &&
          action.context !== "input" &&
          !isComboKey
        ) {
          return false;
        }

        // 如果焦点在表单元素或按钮内，且是单键（如 Enter、Space、字母数字）
        // 只处理 input 或 modal 上下文的快捷键
        // 但组合键（如 Option+Enter）始终允许通过
        if (
          (isFocusInForm || isFocusInButton) &&
          action.context !== "input" &&
          action.context !== "modal" &&
          !isComboKey
        ) {
          return false;
        }

        return matchesShortcut(event, action.parsedShortcut);
      });

      if (matches.length === 0) return;

      // Sort by priority (higher first)
      matches.sort((a, b) => b.priority - a.priority);

      // Execute highest priority match
      const topMatch = matches[0];

      event.preventDefault();
      event.stopPropagation();

      const result = topMatch.handler(event);

      // If handler returns false, stop propagation to lower priority handlers
      if (result === false) {
        return;
      }
    },
    [getCurrentContext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleKeyDown]);

  return {
    getCurrentContext,
    popContext,
    pushContext,
    registerAction,
    updateShortcut,
  };
}

export type ShortcutManager = ReturnType<typeof useShortcutManager>;
