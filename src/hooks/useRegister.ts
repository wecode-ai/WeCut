import {
  isRegistered,
  register,
  type ShortcutHandler,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { useUnmount } from "ahooks";
import { castArray } from "es-toolkit/compat";
import { useEffect, useRef } from "react";

export const useRegister = (
  handler: ShortcutHandler,
  deps: Array<string | string[] | undefined>,
) => {
  const [shortcuts] = deps;
  const oldShortcutsRef = useRef<string | string[] | undefined>(undefined);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // 注销旧快捷键
      for (const shortcut of castArray(oldShortcutsRef.current)) {
        if (!shortcut) continue;
        const registered = await isRegistered(shortcut);
        if (registered) {
          await unregister(shortcut);
        }
      }

      if (cancelled) return;
      if (!shortcuts) return;

      await register(shortcuts, (event) => {
        if (event.state === "Released") return;
        handlerRef.current(event);
      });

      oldShortcutsRef.current = shortcuts;
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts]);

  useUnmount(() => {
    const current = oldShortcutsRef.current;
    if (!current) return;
    unregister(current);
  });
};
