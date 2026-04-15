import type { EventCallback, EventName } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { useMount, useUnmount } from "ahooks";
import { useRef } from "react";

export const useTauriListen = <T>(
  event: EventName,
  handler: EventCallback<T>,
) => {
  const unlistenRef = useRef(() => {});
  // Always keep a ref to the latest handler to avoid stale closures
  const handlerRef = useRef<EventCallback<T>>(handler);
  handlerRef.current = handler;

  useMount(async () => {
    unlistenRef.current = await listen<T>(event, (e) => {
      handlerRef.current(e);
    });
  });

  useUnmount(unlistenRef.current);
};
