import { useUpdateEffect } from "ahooks";
import { FloatButton, Modal } from "antd";
import clsx from "clsx";
import { findIndex } from "es-toolkit/compat";
import { useContext, useEffect, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useSnapshot } from "valtio";
import Scrollbar from "@/components/Scrollbar";
import { LISTEN_KEY } from "@/constants";
import { useShortcutAction } from "@/contexts/ShortcutContext";
import { useHistoryList } from "@/hooks/useHistoryList";
import { useTauriListen } from "@/hooks/useTauriListen";
import { globalStore } from "@/stores/global";
import { MainContext } from "../..";
import Item from "./components/Item";
import NoteModal, { type NoteModalRef } from "./components/NoteModal";
import SendModal, { type SendModalRef } from "./components/SendModal";

const HistoryList = () => {
  const { rootState } = useContext(MainContext);
  const { shortcut } = useSnapshot(globalStore);
  const noteModelRef = useRef<NoteModalRef>(null);
  const sendModalRef = useRef<SendModalRef>(null);
  const [deleteModal, contextHolder] = Modal.useModal();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = (index: number) => {
    return virtuosoRef.current?.scrollIntoView({ index });
  };

  const scrollToTop = () => {
    if (rootState.list.length === 0) return;

    scrollToIndex(0);

    rootState.activeId = rootState.list[0].id;
  };

  const { reload, loadMore } = useHistoryList({ scrollToTop });

  useTauriListen(LISTEN_KEY.ACTIVATE_BACK_TOP, scrollToTop);

  // Navigation shortcuts
  useShortcutAction(
    "list-select-prev",
    "arrowup",
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
    "list-select-next",
    "arrowdown",
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
    "list-jump-start",
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
    "list-jump-end",
    "end",
    () => {
      const { list } = rootState;
      if (list.length > 0) {
        rootState.activeId = list[list.length - 1].id;
      }
    },
    { context: "normal", priority: 10 },
  );

  // Action shortcuts
  useShortcutAction(
    "list-paste",
    "enter",
    () => {
      const { activeId, eventBus } = rootState;
      if (activeId) {
        eventBus?.emit({
          action: LISTEN_KEY.CLIPBOARD_ITEM_PASTE,
          id: activeId,
        });
      }
    },
    { context: "normal", priority: 10 },
  );

  useShortcutAction(
    "list-preview",
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
    "list-delete",
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

  // User-configured send shortcuts
  useShortcutAction(
    "list-send-to-ai-chat",
    shortcut.wegent?.aiChat,
    () => {
      const { activeId } = rootState;
      if (activeId) {
        sendModalRef.current?.open(activeId, "aiChat");
      }
    },
    { context: "normal", priority: 15 },
  );

  useShortcutAction(
    "list-send-to-work-queue",
    shortcut.wegent?.workQueue,
    () => {
      const { activeId } = rootState;
      if (activeId) {
        sendModalRef.current?.open(activeId, "workQueue");
      }
    },
    { context: "normal", priority: 15 },
  );

  // Backward compatibility for old send shortcut
  useShortcutAction(
    "list-send-to-ai",
    shortcut.send,
    () => {
      const { activeId } = rootState;
      if (activeId) {
        sendModalRef.current?.open(activeId);
      }
    },
    { context: "normal", priority: 15 },
  );

  useUpdateEffect(() => {
    const { list } = rootState;

    if (list.length === 0) {
      rootState.activeId = void 0;
    } else {
      rootState.activeId ??= list[0].id;
    }
  }, [rootState.list.length]);

  useEffect(() => {
    const { list, activeId } = rootState;

    if (!activeId) return;

    const index = findIndex(list, { id: activeId });

    if (index < 0) return;

    scrollToIndex(index);
  }, [rootState.activeId]);

  return (
    <>
      <Scrollbar className="flex-1" offsetX={3} ref={scrollerRef}>
        <Virtuoso
          atTopStateChange={(atTop) => {
            if (!atTop || rootState.list.length <= 20) return;

            reload();
          }}
          computeItemKey={(_, item) => item.id}
          customScrollParent={scrollerRef.current ?? void 0}
          data={rootState.list}
          endReached={loadMore}
          itemContent={(index, data) => {
            return (
              <div className={clsx({ "pt-3": index !== 0 })}>
                <Item
                  data={data}
                  deleteModal={deleteModal}
                  handleNote={() => noteModelRef.current?.open(data.id)}
                  handleSend={(serviceType) =>
                    sendModalRef.current?.open(data.id, serviceType)
                  }
                  index={index}
                />
              </div>
            );
          }}
          ref={virtuosoRef}
        />
      </Scrollbar>

      <NoteModal ref={noteModelRef} />
      <SendModal ref={sendModalRef} />

      <FloatButton.BackTop
        duration={0}
        onClick={scrollToTop}
        target={() => scrollerRef.current!}
      />

      {contextHolder}
    </>
  );
};

export default HistoryList;
