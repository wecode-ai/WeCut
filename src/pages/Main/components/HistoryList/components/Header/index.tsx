import { useCreation } from "ahooks";
import { Dropdown, Flex, Tooltip } from "antd";
import clsx from "clsx";
import { filesize } from "filesize";
import {
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  useContext,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import LocalImage from "@/components/LocalImage";
import Scrollbar from "@/components/Scrollbar";
import TagSubMenu from "@/components/TagSubMenu";
import UnoIcon from "@/components/UnoIcon";
import { updateHistory } from "@/database/history";
import { MainContext } from "@/pages/Main";
import { transferData } from "@/pages/Preference/components/Clipboard/components/OperationButton";
import { pasteToClipboard, writeToClipboard } from "@/plugins/clipboard";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import type { DatabaseSchemaHistory } from "@/types/database";
import type { OperationButton } from "@/types/store";
import { dayjs } from "@/utils/dayjs";

interface HeaderProps {
  data: DatabaseSchemaHistory;
  handleNote: () => void;
  handleFavorite: () => void;
  handleDelete: () => void;
  handleSend: (serviceType?: "aiChat" | "workQueue") => void;
}

const Header: FC<HeaderProps> = (props) => {
  const { data } = props;
  const {
    id,
    type,
    value,
    count,
    createTime,
    favorite,
    subtype,
    sourceAppName,
    sourceAppIcon,
    sourceAppPath,
  } = data;
  const { rootState, handlePasteResult, touchHistoryItem } =
    useContext(MainContext);
  const { t, i18n } = useTranslation();
  const { content, wegent } = useSnapshot(clipboardStore);
  const { env } = useSnapshot(globalStore);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTitleClick = (event: MouseEvent) => {
    event.stopPropagation();
    setTitleValue(data.title || "");
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleTitleSave = () => {
    const trimmed = titleValue.trim();
    const newTitle = trimmed || undefined;
    data.title = newTitle;
    updateHistory(id, { title: newTitle });
    setEditing(false);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleTitleSave();
    } else if (event.key === "Escape") {
      setEditing(false);
    }
  };

  const operationButtons = useCreation(() => {
    return content.operationButtons.map((key) => {
      return transferData.find((data) => data.key === key)!;
    });
  }, [content.operationButtons]);

  const renderType = () => {
    switch (subtype) {
      case "url":
        return t("clipboard.label.link");
      case "email":
        return t("clipboard.label.email");
      case "color":
        return t("clipboard.label.color");
      case "path":
        return t("clipboard.label.path");
    }

    switch (type) {
      case "text":
        return t("clipboard.label.plain_text");
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
    }
  };

  const renderCount = () => {
    if (type === "files" || type === "image") {
      return filesize(count, { standard: "jedec" });
    }

    return t("clipboard.label.n_chars", {
      replace: [count],
    });
  };

  const renderPixel = () => {
    if (type !== "image") return;

    const { width, height } = data;

    return (
      <span>
        {width}×{height}
      </span>
    );
  };

  const handleClick = async (event: MouseEvent, key: OperationButton) => {
    const { handleNote, handleFavorite, handleDelete } = props;

    event.stopPropagation();

    switch (key) {
      case "copy":
        await writeToClipboard(data);
        touchHistoryItem?.(data);
        return;
      case "pastePlain": {
        const result = await pasteToClipboard(data, true);
        handlePasteResult?.(result);
        if (result.success) {
          touchHistoryItem?.(data);
        }
        return;
      }
      case "note":
        return handleNote();
      case "star":
        return handleFavorite();
      case "delete":
        return handleDelete();
    }
  };

  // 发送菜单选项
  const sendMenuItems = () => {
    const items = [];

    // WegentChat 仅在环境变量开启时显示
    if (env.features?.wegentChat && wegent?.aiChat?.enabled) {
      items.push({
        icon: "🤖",
        key: "aiChat",
        label: t(
          "preference.shortcut.shortcut.label.send_ai_chat",
          "发送到 WegentChat",
        ),
        onClick: () => {
          setSendMenuOpen(false);
          props.handleSend("aiChat");
        },
        shortcut: globalStore.shortcut.wegent?.aiChat,
      });
    }

    if (wegent?.workQueue?.enabled) {
      items.push({
        icon: "📝",
        key: "workQueue",
        label: t(
          "preference.shortcut.shortcut.label.send_work_queue",
          "发送到 Wegent待办",
        ),
        onClick: () => {
          setSendMenuOpen(false);
          props.handleSend("workQueue");
        },
        shortcut: globalStore.shortcut.wegent?.workQueue,
      });
    }

    return items;
  };

  // 处理发送按钮点击
  const handleSendClick = (event: MouseEvent) => {
    event.stopPropagation();
    const items = sendMenuItems();

    // 如果只有一个服务启用，直接发送
    if (items.length === 1) {
      props.handleSend(items[0].key as "aiChat" | "workQueue");
      return;
    }

    // 如果没有服务启用，提示用户
    if (items.length === 0) {
      // 可以在这里显示一个提示，告诉用户去启用服务
      return;
    }

    // 多个服务启用，显示下拉菜单
    setSendMenuOpen(true);
  };

  return (
    <Flex gap={2} vertical>
      {(editing || data.title) && (
        <div
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {editing ? (
            <input
              className="w-full border-none bg-transparent font-medium text-color-1 text-xs outline-none"
              onBlur={handleTitleSave}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder={t("clipboard.label.input_title", "输入标题")}
              ref={inputRef}
              value={titleValue}
            />
          ) : (
            <span
              className="cursor-text truncate font-medium text-color-1 text-xs"
              onClick={handleTitleClick}
            >
              {data.title}
            </span>
          )}
        </div>
      )}
      <Flex className="text-color-2" gap="small" justify="space-between">
        <Scrollbar thumbSize={0}>
          <Flex
            className="flex-1 cursor-text whitespace-nowrap text-xs"
            gap="small"
            onClick={handleTitleClick}
          >
            {sourceAppIcon && (
              <Tooltip title={sourceAppPath || sourceAppName}>
                <LocalImage
                  className="size-4 rounded-sm object-contain"
                  src={sourceAppIcon}
                />
              </Tooltip>
            )}
            {!sourceAppIcon && sourceAppName && (
              <Tooltip title={sourceAppPath || sourceAppName}>
                <span className="max-w-16 truncate">{sourceAppName}</span>
              </Tooltip>
            )}
            <span>{renderType()}</span>
            <span>{renderCount()}</span>
            {renderPixel()}
            <span>{dayjs(createTime).locale(i18n.language).fromNow()}</span>
          </Flex>
        </Scrollbar>

        <Flex
          align="center"
          className={clsx("opacity-0 transition group-hover:opacity-100", {
            "opacity-100": rootState.activeId === id,
          })}
          gap={6}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {operationButtons.map((item) => {
            const { key, icon, activeIcon, title } = item;

            const isFavorite = key === "star" && favorite;

            // 收藏按钮使用 Dropdown 显示标签子菜单
            if (key === "star") {
              return (
                <Dropdown
                  dropdownRender={() => (
                    <TagSubMenu
                      historyId={id}
                      onClose={() => setTagMenuOpen(false)}
                      onManageTags={() => {
                        // 打开偏好设置标签管理页
                        window.open("/preference?tab=tag", "_self");
                      }}
                    />
                  )}
                  key={key}
                  onOpenChange={setTagMenuOpen}
                  open={tagMenuOpen}
                  placement="bottomRight"
                  trigger={["click"]}
                >
                  <UnoIcon
                    className={clsx({ "text-gold!": isFavorite })}
                    hoverable
                    name={isFavorite ? activeIcon : icon}
                    title={t("tag.favorite_title", "收藏")}
                  />
                </Dropdown>
              );
            }

            // 发送按钮使用 Dropdown 显示服务选择菜单
            if (key === "send") {
              const sendItems = sendMenuItems();

              // 如果没有启用任何服务，直接返回普通按钮（点击后可能提示去配置）
              if (sendItems.length === 0) {
                return (
                  <UnoIcon
                    className={clsx({ "text-gold!": isFavorite })}
                    hoverable
                    key={key}
                    name={isFavorite ? activeIcon : icon}
                    onClick={handleSendClick}
                    title={t(title)}
                  />
                );
              }

              // 只有一个服务启用，直接点击发送
              if (sendItems.length === 1) {
                return (
                  <UnoIcon
                    className={clsx({ "text-gold!": isFavorite })}
                    hoverable
                    key={key}
                    name={isFavorite ? activeIcon : icon}
                    onClick={handleSendClick}
                    title={sendItems[0].label}
                  />
                );
              }

              // 多个服务启用，显示下拉菜单
              return (
                <Dropdown
                  dropdownRender={() => (
                    <div
                      className="ant-dropdown-menu ant-dropdown-menu-root ant-dropdown-menu-vertical ant-dropdown-menu-light"
                      style={{
                        backgroundColor: "var(--ant-color-bg-elevated)",
                        borderRadius: "var(--ant-border-radius-lg)",
                        boxShadow: "var(--ant-box-shadow-secondary)",
                      }}
                    >
                      {sendItems.map((sendItem) => (
                        <div
                          className="ant-dropdown-menu-item"
                          key={sendItem.key}
                          onClick={sendItem.onClick}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              sendItem.onClick();
                            }
                          }}
                          role="menuitem"
                          style={{
                            alignItems: "center",
                            cursor: "pointer",
                            display: "flex",
                            gap: 8,
                            padding: "8px 12px",
                            transition: "background-color 0.2s",
                          }}
                          tabIndex={0}
                        >
                          <span style={{ fontSize: 16 }}>{sendItem.icon}</span>
                          <span style={{ flex: 1 }}>{sendItem.label}</span>
                          {sendItem.shortcut && (
                            <span
                              style={{
                                color: "var(--ant-color-text-secondary)",
                                fontSize: 12,
                              }}
                            >
                              {sendItem.shortcut}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  key={key}
                  onOpenChange={setSendMenuOpen}
                  open={sendMenuOpen}
                  placement="bottomRight"
                  trigger={["click"]}
                >
                  <UnoIcon
                    className={clsx({ "text-gold!": isFavorite })}
                    hoverable
                    name={isFavorite ? activeIcon : icon}
                    title={t(title)}
                  />
                </Dropdown>
              );
            }

            return (
              <UnoIcon
                className={clsx({ "text-gold!": isFavorite })}
                hoverable
                key={key}
                name={isFavorite ? activeIcon : icon}
                onClick={(event) => handleClick(event, key)}
                title={t(title)}
              />
            );
          })}
        </Flex>
      </Flex>
    </Flex>
  );
};

export default Header;
