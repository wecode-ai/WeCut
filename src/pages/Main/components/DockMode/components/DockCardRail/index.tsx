import { Button } from "antd";
import type { HookAPI } from "antd/es/modal/useModal";
import clsx from "clsx";
import { type FC, useEffect, useMemo, useRef, useState } from "react";
import Scrollbar from "@/components/Scrollbar";
import type { DatabaseSchemaHistory } from "@/types/database";
import PasteCard from "../PasteCard";

export interface DockCardRailProps {
  items: DatabaseSchemaHistory[];
  activeId?: string;
  afterHide?: () => void;
  beforeActivate?: () => void;
  deleteModal: HookAPI;
  hasFilters?: boolean;
  onActiveChange: (id: string) => void;
  onLoadMore?: () => void;
  onNote: (id: string) => void;
  onResetFilters: () => void;
  onSend: (id: string, serviceType?: "aiChat" | "workQueue") => void;
}

const DockCardRail: FC<DockCardRailProps> = (props) => {
  const {
    items,
    activeId,
    afterHide,
    beforeActivate,
    deleteModal,
    hasFilters,
    onActiveChange,
    onLoadMore,
    onNote,
    onResetFilters,
    onSend,
  } = props;
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLElement>(null);

  // 将垂直滚轮转为水平滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // 读取 dock 缩放比例
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      const root = document.documentElement;
      const computedScale = getComputedStyle(root)
        .getPropertyValue("--dock-scale")
        .trim();
      setScale(parseFloat(computedScale) || 1);
    };
    updateScale();
    const observer = new MutationObserver(updateScale);
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // 根据缩放调整间距
  const gapStyle = useMemo(
    () => ({
      gap: `${Math.round(8 * scale)}px`,
      paddingLeft: `${Math.round(4 * scale)}px`,
      paddingRight: `${Math.round(4 * scale)}px`,
      scrollPaddingLeft: `${Math.round(32 * scale)}px`,
      scrollPaddingRight: `${Math.round(32 * scale)}px`,
    }),
    [scale],
  );

  useEffect(() => {
    if (activeId || items.length === 0) return;

    onActiveChange(items[0].id);
  }, [activeId, items, onActiveChange]);

  useEffect(() => {
    if (!activeId) return;

    cardRefs.current[activeId]?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeId]);

  // 根据缩放计算卡片高度
  const cardHeight = Math.round(280 * scale);

  return (
    <div
      className="flex overflow-hidden rounded-[30px] border border-white/80 bg-white/68 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-sm"
      style={{ height: cardHeight + 16 }}
    >
      <Scrollbar
        className="flex-1"
        hideScrollbar
        offsetY={0}
        onScroll={(event) => {
          if (!onLoadMore) return;

          const currentTarget = event.currentTarget;
          const distanceToEnd =
            currentTarget.scrollWidth -
            currentTarget.clientWidth -
            currentTarget.scrollLeft;

          if (distanceToEnd < 320) {
            onLoadMore();
          }
        }}
        ref={scrollRef}
      >
        {items.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-[26px] border border-slate-300 border-dashed bg-slate-50/80 px-6 text-center">
            <div className="font-medium text-base text-color-1">
              No clips in this view
            </div>
            <div className="mt-2 max-w-90 text-color-3 text-sm">
              {hasFilters
                ? "Your current search or filter removed every card from the rail."
                : "Clipboard history will appear here as a single horizontal rail."}
            </div>
            {hasFilters ? (
              <Button
                className="mt-4 rounded-full"
                onClick={onResetFilters}
                size="small"
                type="default"
              >
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div
            className="flex h-full min-w-max snap-x snap-mandatory items-center px-1"
            style={gapStyle}
          >
            {items.map((item, index) => {
              return (
                <div
                  className={clsx("flex h-full snap-center items-center")}
                  key={item.id}
                  ref={(node) => {
                    cardRefs.current[item.id] = node;
                  }}
                >
                  <PasteCard
                    active={item.id === activeId}
                    afterHide={afterHide}
                    beforeActivate={beforeActivate}
                    data={item}
                    deleteModal={deleteModal}
                    handleNote={() => {
                      onNote(item.id);
                    }}
                    handleSend={(serviceType) => {
                      onSend(item.id, serviceType);
                    }}
                    index={index}
                    onSelect={() => {
                      onActiveChange(item.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Scrollbar>
    </div>
  );
};

export default DockCardRail;
