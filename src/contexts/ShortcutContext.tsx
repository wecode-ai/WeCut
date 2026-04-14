import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  type ShortcutContext as ShortcutContextType,
  type ShortcutManager,
  useShortcutManager,
} from "@/hooks/useShortcutManager";

const ShortcutContext = createContext<ShortcutManager | null>(null);

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const shortcutManager = useShortcutManager();

  return (
    <ShortcutContext.Provider value={shortcutManager}>
      {children}
    </ShortcutContext.Provider>
  );
};

export function useShortcut() {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error("useShortcut must be used within ShortcutProvider");
  }
  return context;
}

/**
 * Hook to register a shortcut action
 */
export function useShortcutAction(
  id: string,
  shortcut: string,
  handler: (event: KeyboardEvent) => undefined | boolean,
  options: {
    context?: ShortcutContextType;
    priority?: number;
    description?: string;
  } = {},
) {
  const { registerAction } = useShortcut();
  const { context = "normal", priority = 0, description } = options;

  // Use ref to avoid re-registering when handler changes
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback(
    (event: KeyboardEvent) => handlerRef.current(event),
    [],
  );

  useEffect(() => {
    const unregister = registerAction({
      context,
      description,
      handler: stableHandler,
      id,
      priority,
      shortcut,
    });

    return unregister;
  }, [
    id,
    shortcut,
    context,
    priority,
    description,
    registerAction,
    stableHandler,
  ]);
}

/**
 * Hook to push/pop a context when a component mounts/unmounts
 * Useful for Modals, Drawers, etc.
 */
export function useShortcutContext(context: ShortcutContextType) {
  const { pushContext, popContext } = useShortcut();
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (!isActiveRef.current) {
      pushContext(context);
      isActiveRef.current = true;
    }

    return () => {
      if (isActiveRef.current) {
        popContext(context);
        isActiveRef.current = false;
      }
    };
  }, [context, pushContext, popContext]);

  return {
    isActive: () => isActiveRef.current,
  };
}

/**
 * Hook to temporarily disable all shortcuts (except those in "modal" context)
 * Useful for input fields, textareas
 */
export function useDisableShortcutsWhileFocused(
  ref: React.RefObject<HTMLElement>,
  options: {
    disabledContexts?: ShortcutContextType[];
  } = {},
) {
  const { pushContext, popContext } = useShortcut();
  const { disabledContexts = ["normal"] } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleFocus = () => {
      for (const _ of disabledContexts) {
        pushContext("input");
      }
    };

    const handleBlur = () => {
      for (const _ of disabledContexts) {
        popContext("input");
      }
    };

    element.addEventListener("focus", handleFocus);
    element.addEventListener("blur", handleBlur);

    // If already focused
    if (document.activeElement === element) {
      handleFocus();
    }

    return () => {
      element.removeEventListener("focus", handleFocus);
      element.removeEventListener("blur", handleBlur);
      handleBlur(); // Clean up
    };
  }, [ref, pushContext, popContext, disabledContexts]);
}
