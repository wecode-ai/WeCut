import { openPath } from "@tauri-apps/plugin-opener";
import { useAsyncEffect } from "ahooks";
import { Dropdown } from "antd";
import type { HookAPI } from "antd/es/modal/useModal";
import clsx from "clsx";
import { filesize } from "filesize";
import {
  type FC,
  type KeyboardEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Marker } from "react-mark.js";
import { icon } from "tauri-plugin-fs-pro-api";
import { useSnapshot } from "valtio";
import LocalImage from "@/components/LocalImage";
import UnoIcon from "@/components/UnoIcon";
import { LISTEN_KEY } from "@/constants";
import { useShortcut } from "@/contexts/ShortcutContext";
import { updateHistory } from "@/database/history";
import { useContextMenu } from "@/hooks/useContextMenu";
import { MainContext } from "@/pages/Main";
import { runActivateAction } from "@/plugins/clipboard";
import { hideWindow } from "@/plugins/window";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import type { DatabaseSchemaHistory } from "@/types/database";
import { dayjs } from "@/utils/dayjs";
import { runDockAction } from "@/utils/dockAction";
import { isImage, isLinux } from "@/utils/is";

export interface PasteCardProps {
  active?: boolean;
  afterHide?: () => void;
  beforeActivate?: () => void;
  data: DatabaseSchemaHistory;
  deleteModal: HookAPI;
  handleNote: () => void;
  handleSend: (serviceType?: "aiChat" | "workQueue") => void;
  index: number;
  onSelect: () => void;
}

const getFileName = (value: string) => {
  const parts = value.split(/[/\\]/);

  return parts.at(-1) || value;
};

const stripPreviewText = (value: string) => {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const getTypeColorClass = (type: DatabaseSchemaHistory["type"]) => {
  switch (type) {
    case "image":
      return "bg-sky-600";
    case "files":
      return "bg-amber-600";
    case "rtf":
    case "html":
      return "bg-violet-600";
    default:
      return "bg-primary";
  }
};

const PasteCard: FC<PasteCardProps> = (props) => {
  const {
    active,
    afterHide,
    beforeActivate,
    data,
    deleteModal,
    handleNote,
    handleSend,
    index,
    onSelect,
  } = props;
  const { id, count, createTime, favorite, note, subtype, type, value } = data;
  const { rootState, handlePasteResult, touchHistoryItem } =
    useContext(MainContext);
  const { t, i18n } = useTranslation();
  const { wegent } = useSnapshot(clipboardStore);
  const { env, shortcut } = useSnapshot(globalStore);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);

  // 获取启用的服务列表
  const enabledServices = useMemo(() => {
    const services: Array<{
      key: "aiChat" | "workQueue";
      label: string;
      icon: string;
    }> = [];
    // WegentChat 仅在环境变量开启时显示
    if (env.features?.wegentChat && wegent?.aiChat?.enabled) {
      services.push({
        icon: "🤖",
        key: "aiChat",
        label: t("preference.wegent.settings.label.ai_chat", "WegentChat"),
      });
    }
    if (wegent?.workQueue?.enabled) {
      services.push({
        icon: "📝",
        key: "workQueue",
        label: t("preference.wegent.settings.label.work_queue", "Wegent 待办"),
      });
    }
    return services;
  }, [wegent, env.features?.wegentChat, t]);

  // 生成发送菜单项
  const sendMenuItems = useMemo(() => {
    return enabledServices.map((service) => ({
      key: service.key,
      label: (
        <div className="flex items-center gap-2 py-1">
          <span>{service.icon}</span>
          <span className="flex-1">{service.label}</span>
          {shortcut.wegent?.[service.key] && (
            <span className="text-color-3 text-xs">
              {shortcut.wegent[service.key]}
            </span>
          )}
        </div>
      ),
      onClick: () => handleSend(service.key),
    }));
  }, [enabledServices, shortcut.wegent, handleSend]);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // 获取快捷键管理器
  const { pushContext, popContext } = useShortcut();

  const handleTitleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setTitleValue(data.title || "");
    setEditingTitle(true);
    requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  const handleTitleSave = () => {
    const trimmed = titleValue.trim();
    const newTitle = trimmed || undefined;
    data.title = newTitle;
    updateHistory(id, { title: newTitle });
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleTitleSave();
    } else if (event.key === "Escape") {
      setEditingTitle(false);
    }
  };

  // 获取文件系统图标（和标准模式 File 组件一样的逻辑）
  const [fileIcon, setFileIcon] = useState<string>();
  useAsyncEffect(async () => {
    if (type !== "files" || !Array.isArray(value) || value.length === 0) return;
    if (isLinux) return;
    try {
      const iconPath = await icon(value[0], { size: 256 });
      setFileIcon(iconPath);
    } catch {}
  }, [type, value]);

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
    // 监听变化
    const observer = new MutationObserver(updateScale);
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // 基础尺寸（单位：px）
  const baseWidth = 296; // w-74 = 18.5rem = 296px
  const baseHeight = 280; // min-h-70 = 17.5rem = 280px
  const baseMaxImageHeight = 176; // max-h-44 = 11rem = 176px

  const cardStyle = useMemo(
    () =>
      ({
        "--card-scale": scale,
        "--preview-max-height": `${Math.round(baseMaxImageHeight * scale)}px`,
        height: `${Math.round(baseHeight * scale)}px`,
        width: `${Math.round(baseWidth * scale)}px`,
      }) as React.CSSProperties,
    [scale],
  );

  const typeLabel = useMemo(() => {
    switch (type) {
      case "text":
        switch (subtype) {
          case "url":
            return t("clipboard.label.link");
          case "email":
            return t("clipboard.label.email");
          case "color":
            return t("clipboard.label.color");
          case "path":
            return t("clipboard.label.path");
          default:
            return t("clipboard.label.plain_text");
        }
      case "rtf":
        return t("clipboard.label.rtf");
      case "html":
        return t("clipboard.label.html");
      case "image":
        return t("clipboard.label.image");
      case "files":
        return t("clipboard.label.n_files", {
          replace: [value.length],
        });
      default:
        return type;
    }
  }, [subtype, t, type, value]);

  // 预览最多截取的字符数：卡片最多显示 6 行 × ~60 字符，取 500 已足够
  const PREVIEW_MAX_CHARS = 500;
  // 文本开头展示的字符数
  const PREVIEW_HEAD_CHARS = 100;
  // 搜索词命中时，在匹配位置前后各保留的上下文字符数
  const SEARCH_CONTEXT_CHARS = 60;

  // 返回 { head, context } 两段，context 仅在搜索词超出 head 范围时存在
  const textPreviewParts = useMemo(() => {
    if (Array.isArray(value)) {
      return {
        head: value.map((item) => getFileName(String(item))).join("\n"),
      };
    }

    const getRawText = () => {
      if (typeof value === "string") {
        if (type === "html" || type === "rtf") {
          return stripPreviewText(value);
        }
        return value;
      }
      return JSON.stringify(value, null, 2);
    };

    const raw = getRawText();
    const search = rootState.search?.trim();

    // 有搜索词时，尝试找到匹配位置并在开头文本后附加上下文片段
    if (search) {
      const matchIndex = raw.toLowerCase().indexOf(search.toLowerCase());
      // 匹配位置在前 PREVIEW_HEAD_CHARS 之外，才需要附加上下文
      if (matchIndex >= PREVIEW_HEAD_CHARS) {
        const head = raw.slice(0, PREVIEW_HEAD_CHARS);
        // 搜索词前只保留少量字符，确保搜索词出现在 context 第一行
        const CONTEXT_PREFIX_CHARS = 5;
        const ctxStart = Math.max(
          PREVIEW_HEAD_CHARS,
          matchIndex - CONTEXT_PREFIX_CHARS,
        );
        const ctxEnd = Math.min(
          raw.length,
          matchIndex + search.length + SEARCH_CONTEXT_CHARS,
        );
        const ctxPrefix = ctxStart > PREVIEW_HEAD_CHARS ? "…" : "";
        const ctxSuffix = ctxEnd < raw.length ? "…" : "";
        return {
          context: ctxPrefix + raw.slice(ctxStart, ctxEnd) + ctxSuffix,
          head,
        };
      }
    }

    return { head: raw.slice(0, PREVIEW_MAX_CHARS) };
  }, [type, value, rootState.search]);

  // 兼容旧引用（color 预览等仍使用 textPreview）
  const textPreview = textPreviewParts.head;

  const summary = useMemo(() => {
    if (type === "image" || type === "files") {
      if (type === "files" && value.length === 1) {
        return getFileName(value[0]);
      }

      return filesize(count, { standard: "jedec" });
    }

    return t("clipboard.label.n_chars", {
      replace: [count],
    });
  }, [count, t, type, value]);

  const handlePreview = () => {
    if (type === "image") {
      openPath(value);
      return;
    }

    if (type === "files" && value.length === 1 && isImage(value[0])) {
      openPath(value[0]);
    }
  };

  const handleNext = () => {
    const currentIndex = rootState.list.findIndex((item) => item.id === id);

    if (currentIndex < 0) return;

    const nextItem =
      rootState.list[currentIndex + 1] ?? rootState.list[currentIndex - 1];

    rootState.activeId = nextItem?.id;
  };

  const handlePrev = () => {
    const currentIndex = rootState.list.findIndex((item) => item.id === id);

    if (currentIndex <= 0) return;

    rootState.activeId = rootState.list[currentIndex - 1].id;
  };

  const { handleContextMenu, handleDelete, handleFavorite } = useContextMenu({
    afterHide,
    beforeActivate,
    data,
    deleteModal,
    handleNext,
    handleNote,
    handleSend,
    index,
  });

  rootState.eventBus?.useSubscription(async (payload) => {
    if (payload.id !== id) return;

    switch (payload.action) {
      case LISTEN_KEY.CLIPBOARD_ITEM_PREVIEW:
        return handlePreview();
      case LISTEN_KEY.CLIPBOARD_ITEM_PASTE: {
        await runDockAction({
          action: () => runActivateAction(data),
          afterHide,
          beforeAction: beforeActivate,
          hideWindow,
          onResult: (result) => {
            handlePasteResult?.(result);
            if (result.success) {
              touchHistoryItem?.(data);
            }
          },
        });
        return;
      }
      case LISTEN_KEY.CLIPBOARD_ITEM_DELETE:
        return handleDelete();
      case LISTEN_KEY.CLIPBOARD_ITEM_SELECT_PREV:
        return handlePrev();
      case LISTEN_KEY.CLIPBOARD_ITEM_SELECT_NEXT:
        return handleNext();
      case LISTEN_KEY.CLIPBOARD_ITEM_FAVORITE:
        return handleFavorite();
    }
  });

  const renderTextPreview = () => {
    // 根据缩放比例调整颜色预览行数
    const colorLineCount = Math.max(2, Math.round(4 * scale));

    if (subtype === "color" && typeof value === "string") {
      return (
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-8 shrink-0 rounded-full border border-white/40 shadow-inner"
            style={{ background: value }}
          />
          <span
            className="overflow-hidden break-all text-color-1 text-sm"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: colorLineCount,
            }}
          >
            <Marker mark={rootState.search}>{textPreview}</Marker>
          </span>
        </div>
      );
    }

    const { head, context } = textPreviewParts;

    // 有搜索词命中且超出开头范围时，分两段显示
    if (context) {
      return (
        <div className="flex h-full flex-col gap-1 overflow-hidden text-color-1 text-sm">
          <div
            className="overflow-hidden whitespace-pre-wrap break-all"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            <Marker mark={rootState.search}>{head}</Marker>
          </div>
          <div className="shrink-0 border-slate-200 border-t" />
          <div
            className="overflow-hidden whitespace-pre-wrap break-all"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: Math.max(2, Math.round(4 * scale)),
            }}
          >
            <Marker mark={rootState.search}>{context}</Marker>
          </div>
        </div>
      );
    }

    // 根据缩放比例调整行数
    const lineCount = Math.max(3, Math.round(6 * scale));

    return (
      <div
        className="overflow-hidden whitespace-pre-wrap break-all text-color-1 text-sm"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: lineCount,
        }}
      >
        <Marker mark={rootState.search}>{textPreview}</Marker>
      </div>
    );
  };

  const renderFilesPreview = () => {
    if (!Array.isArray(value)) return null;

    if (value.length === 1 && isImage(value[0])) {
      return (
        <LocalImage
          className="h-full w-full rounded-2xl object-contain"
          src={value[0]}
          style={{ maxHeight: `calc(176px * ${scale})` }}
        />
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        {fileIcon && (
          <LocalImage
            className="h-16 w-16 shrink-0 object-contain"
            src={fileIcon}
          />
        )}
        <div className="flex w-full flex-col gap-1">
          {value.slice(0, 4).map((path: string) => {
            return (
              <div
                className="flex items-center justify-center gap-2 rounded-2xl bg-color-2/70 px-3 py-1.5"
                key={path}
              >
                <span className="truncate text-color-1 text-sm">
                  {getFileName(path)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderImagePreview = () => {
    return (
      <LocalImage
        className="h-full w-full rounded-2xl object-contain"
        src={String(value)}
        style={{ maxHeight: `calc(176px * ${scale})` }}
      />
    );
  };

  const renderPreview = () => {
    switch (type) {
      case "image":
        return renderImagePreview();
      case "files":
        return renderFilesPreview();
      default:
        return renderTextPreview();
    }
  };

  const actionButtons = [
    {
      icon: note ? "i-hugeicons:task-edit-01" : "i-lucide:notebook-pen",
      key: "note",
      onClick: handleNote,
      title: "Note",
    },
    {
      icon: favorite ? "i-lucide:star-off" : "i-lucide:star",
      key: "favorite",
      onClick: handleFavorite,
      title: favorite ? "Unfavorite" : "Favorite",
    },
    {
      icon: "i-lucide:trash",
      key: "delete",
      onClick: handleDelete,
      title: "Delete",
    },
  ];

  const handleCardClick = () => {
    rootState.activeId = id;

    onSelect();
  };

  const handleCardDoubleClick = async () => {
    rootState.activeId = id;
    await runDockAction({
      action: () => runActivateAction(data),
      afterHide,
      beforeAction: beforeActivate,
      hideWindow,
      onResult: (result) => {
        handlePasteResult?.(result);
        if (result.success) {
          touchHistoryItem?.(data);
        }
      },
    });
  };

  const cardContent = (
    <button
      className={clsx(
        "group flex shrink-0 flex-col overflow-hidden rounded-[28px] border bg-white text-left transition-[transform,box-shadow] duration-150",
        "shadow-[0_14px_32px_rgba(15,23,42,0.08)] hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(15,23,42,0.14)]",
        {
          "border-primary shadow-[0_22px_56px_rgba(59,130,246,0.22)] ring-2 ring-primary/15":
            active,
          "border-slate-200": !active,
        },
      )}
      onClick={handleCardClick}
      onContextMenu={(e) => {
        handleContextMenu(e);
      }}
      onDoubleClick={handleCardDoubleClick}
      style={cardStyle}
      type="button"
    >
      <div
        className={clsx(
          "relative overflow-hidden px-3 py-2 text-white",
          getTypeColorClass(type),
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-white/10 blur-2xl" />
        <div className="flex items-start justify-between gap-2">
          <div className="relative min-w-0 flex-1">
            {editingTitle ? (
              <input
                className="w-full border-none bg-transparent font-semibold text-sm text-white tracking-wide placeholder-white/50 outline-none"
                onBlur={() => {
                  // 弹出 input 上下文，恢复数字键快捷键
                  popContext("input");
                  handleTitleSave();
                }}
                onChange={(e) => setTitleValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onFocus={() => {
                  // 推入 input 上下文，禁用数字键快捷键
                  pushContext("input");
                }}
                onKeyDown={handleTitleKeyDown}
                placeholder={t("clipboard.label.input_title", "输入标题")}
                ref={titleInputRef}
                value={titleValue}
              />
            ) : (
              <div
                className="cursor-text truncate font-semibold text-sm tracking-wide"
                onClick={handleTitleClick}
              >
                {data.title || typeLabel}
              </div>
            )}
            <div className="mt-0.5 text-white/80 text-xs">
              {data.title ? `${typeLabel} · ` : ""}
              {dayjs(createTime).locale(i18n.language).fromNow()}
            </div>
          </div>
          {enabledServices.length > 1 ? (
            <Dropdown
              menu={{ items: sendMenuItems }}
              onOpenChange={setSendMenuOpen}
              open={sendMenuOpen}
              overlayClassName="send-dropdown"
              placement="bottomRight"
              trigger={["click"]}
            >
              <span
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/40"
                onClick={(event) => event.stopPropagation()}
                title="Send to AI"
              >
                <UnoIcon name="i-lucide:send" />
              </span>
            </Dropdown>
          ) : (
            <span
              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/40"
              onClick={(event) => {
                event.stopPropagation();
                handleSend();
              }}
              title="Send to AI"
            >
              <UnoIcon name="i-lucide:send" />
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-start px-4 py-3.5">
        <div className="h-full max-h-full w-full overflow-hidden">
          {renderPreview()}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-slate-200 border-t px-4 py-3 text-color-3 text-xs">
        <span className="truncate pr-4">{summary}</span>

        <div
          className={clsx(
            "flex items-center gap-2 transition-opacity",
            active ? "opacity-100" : "opacity-60 group-hover:opacity-100",
          )}
        >
          {actionButtons.map((item) => (
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-color-2 hover:text-color-1"
              key={item.key}
              onClick={(event) => {
                event.stopPropagation();
                item.onClick();
              }}
              title={item.title}
            >
              <UnoIcon name={item.icon} />
            </span>
          ))}

          <span className="min-w-5 text-right">{index + 1}</span>
        </div>
      </div>
    </button>
  );

  return cardContent;
};

export default PasteCard;
