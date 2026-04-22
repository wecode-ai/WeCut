import {
  CheckMenuItem,
  Menu,
  MenuItem,
  type MenuItemOptions,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { downloadDir } from "@tauri-apps/api/path";
import { copyFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { Input, Modal, message } from "antd";
import { find, isArray, remove } from "es-toolkit/compat";
import { type MouseEvent, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { useShortcut } from "@/contexts/ShortcutContext";
import { deleteHistory, updateHistory } from "@/database/history";
import { hasTag } from "@/database/tag";
import { MainContext } from "@/pages/Main";
import { pasteToClipboard, writeToClipboard } from "@/plugins/clipboard";
import { hideWindow } from "@/plugins/window";
import { clipboardStore, tagActions } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import { textExpansionActions } from "@/stores/textExpansion";
import type { DatabaseSchemaHistory } from "@/types/database";
import { runDockAction } from "@/utils/dockAction";
import { isMac } from "@/utils/is";
import { join } from "@/utils/path";

interface UseContextMenuProps {
  afterHide?: () => void;
  beforeActivate?: () => void;
  data: DatabaseSchemaHistory;
  deleteModal: HookAPI;
  handleNote: () => void;
  handleNext: () => void;
  handleSend: (serviceType?: "aiChat" | "workQueue") => void;
  index: number;
}

interface ContextMenuItem extends MenuItemOptions {
  hide?: boolean;
}

export const useContextMenu = (props: UseContextMenuProps) => {
  const {
    afterHide,
    beforeActivate,
    data,
    deleteModal,
    handleNote,
    handleNext,
  } = props;
  const { id, type, value, group, favorite, subtype } = data;
  const { t } = useTranslation();
  const { env } = useSnapshot(globalStore);
  const { rootState, touchHistoryItem } = useContext(MainContext);
  const { pushContext, popContext } = useShortcut();

  const pasteAsText = async () => {
    if (clipboardStore.window.style === "dock") {
      await runDockAction({
        action: () => pasteToClipboard(data, true),
        afterHide,
        beforeAction: beforeActivate,
        hideWindow,
        onResult: (result) => {
          if (result.success) {
            touchHistoryItem?.(data);
          }
        },
      });
      return;
    }

    const result = await pasteToClipboard(data, true);
    if (result.success) {
      touchHistoryItem?.(data);
    }
  };

  const handleFavorite = async () => {
    const nextFavorite = !favorite;

    const matched = find(rootState.list, { id });

    if (!matched) return;

    matched.favorite = nextFavorite;

    updateHistory(id, { favorite: nextFavorite });
  };

  const openToBrowser = () => {
    if (type !== "text") return;

    const url = value.startsWith("http") ? value : `http://${value}`;

    openUrl(url);
  };

  const exportToFile = async () => {
    if (isArray(value)) return;

    const extname = type === "text" ? "txt" : type;
    const fileName = `${env.appName}_${id}.${extname}`;
    const path = join(await downloadDir(), fileName);

    await writeTextFile(path, value);

    revealItemInDir(path);
  };

  const downloadImage = async () => {
    if (type !== "image") return;

    const fileName = `${env.appName}_${id}.png`;
    const path = join(await downloadDir(), fileName);

    await copyFile(value, path);

    revealItemInDir(path);
  };

  const openToFinder = () => {
    if (type === "text") {
      return revealItemInDir(value);
    }

    const [file] = value;

    revealItemInDir(file);
  };

  const handleDelete = async () => {
    const matched = find(rootState.list, { id });

    if (!matched) return;

    let confirmed = true;

    if (clipboardStore.content.deleteConfirm) {
      confirmed = await deleteModal.confirm({
        afterClose() {
          // 关闭确认框后焦点还在，需要手动取消焦点
          (document.activeElement as HTMLElement)?.blur();
        },
        centered: true,
        content: t("clipboard.hints.delete_modal_content"),
        keyboard: true,
      });
    }

    if (!confirmed) return;

    if (id === rootState.activeId) {
      handleNext();
    }

    remove(rootState.list, { id });

    deleteHistory(data);
  };

  const handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();

    rootState.activeId = id;

    try {
      const items: ContextMenuItem[] = [
        {
          action: async () => {
            await writeToClipboard(data);
            touchHistoryItem?.(data);
          },
          text: t("clipboard.button.context_menu.copy"),
        },
        {
          action: handleNote,
          text: t("clipboard.button.context_menu.note"),
        },
        {
          action: pasteAsText,
          hide: type !== "html" && type !== "rtf",
          text: t("clipboard.button.context_menu.paste_as_plain_text"),
        },
        {
          action: pasteAsText,
          hide: type !== "files",
          text: t("clipboard.button.context_menu.paste_as_path"),
        },
        {
          action: openToBrowser,
          hide: subtype !== "url",
          text: t("clipboard.button.context_menu.open_in_browser"),
        },
        {
          action: () => openUrl(`mailto:${value}`),
          hide: subtype !== "email",
          text: t("clipboard.button.context_menu.send_email"),
        },
        {
          action: exportToFile,
          hide: group !== "text",
          text: t("clipboard.button.context_menu.export_as_file"),
        },
        {
          action: downloadImage,
          hide: type !== "image",
          text: t("clipboard.button.context_menu.download_image"),
        },
        {
          action: openToFinder,
          hide: type !== "files" && subtype !== "path",
          text: isMac
            ? t("clipboard.button.context_menu.show_in_finder")
            : t("clipboard.button.context_menu.show_in_file_explorer"),
        },
      ];

      const menu = await Menu.new();

      // 顺序 append 普通菜单项（不含收藏和删除）
      for (const item of items.filter(({ hide }) => !hide)) {
        await menu.append(await MenuItem.new(item));
      }

      // 收藏子菜单 / 收藏切换
      const { tags } = clipboardStore;

      if (tags.length > 0) {
        await menu.append(await PredefinedMenuItem.new({ item: "Separator" }));

        const favoriteSubmenu = await Submenu.new({
          text: t("clipboard.button.context_menu.favorite"),
        });

        // 默认收藏（无标签）
        await favoriteSubmenu.append(
          await CheckMenuItem.new({
            action: () => handleFavorite(),
            checked: !!favorite,
            text: favorite
              ? t("clipboard.button.context_menu.unfavorite")
              : t("clipboard.button.context_menu.favorite"),
          }),
        );

        await favoriteSubmenu.append(
          await PredefinedMenuItem.new({ item: "Separator" }),
        );

        // 各标签项
        for (const tag of tags) {
          const checked = await hasTag(id, tag.id);

          await favoriteSubmenu.append(
            await CheckMenuItem.new({
              action: async () => {
                if (checked) {
                  await tagActions.removeTagFromHistory(id, tag.id);
                } else {
                  await tagActions.addTagToHistory(id, tag.id);
                }
              },
              checked,
              text: tag.name,
            }),
          );
        }

        await menu.append(favoriteSubmenu);
      } else {
        await menu.append(
          await MenuItem.new({
            action: () => handleFavorite(),
            text: favorite
              ? t("clipboard.button.context_menu.unfavorite")
              : t("clipboard.button.context_menu.favorite"),
          }),
        );
      }

      // 设为快捷粘贴 (仅文本类型)
      if (type === "text" || type === "html" || type === "rtf") {
        await menu.append(await PredefinedMenuItem.new({ item: "Separator" }));
        await menu.append(
          await MenuItem.new({
            action: () => {
              const triggerWordRef = { current: "" };
              const modal = Modal.confirm({
                content: (
                  <Input
                    autoFocus
                    onBlur={() => {
                      // 弹出 input 上下文，恢复数字键快捷键
                      popContext("input");
                    }}
                    onChange={(e) => {
                      triggerWordRef.current = e.target.value.trim();
                      modal.update({
                        okButtonProps: { disabled: !e.target.value.trim() },
                      });
                    }}
                    onFocus={() => {
                      // 推入 input 上下文，禁用数字键快捷键
                      pushContext("input");
                    }}
                    onPressEnter={() => {
                      if (!triggerWordRef.current) return;
                      modal.update({ okButtonProps: { loading: true } });
                      // Trigger onOk manually
                      const okButton = document.querySelector(
                        ".ant-modal-confirm-btns .ant-btn-primary",
                      ) as HTMLButtonElement;
                      okButton?.click();
                    }}
                    placeholder="输入快捷词,如: u123"
                  />
                ),
                okButtonProps: { disabled: true },
                onOk: async () => {
                  const triggerWord = triggerWordRef.current;
                  if (!triggerWord) return;

                  const content =
                    type === "text" ? value : data.search || value;

                  const result = await textExpansionActions.addExpansion(
                    triggerWord,
                    content,
                    data.id,
                  );

                  if (result.success) {
                    message.success("快捷粘贴已创建");
                  } else {
                    message.error(result.error || "创建失败");
                    throw new Error(result.error);
                  }
                },
                title: "设为快捷粘贴",
              });
            },
            text: "设为快捷粘贴",
          }),
        );
      }

      // 删除
      await menu.append(await PredefinedMenuItem.new({ item: "Separator" }));
      await menu.append(
        await MenuItem.new({
          action: handleDelete,
          text: t("clipboard.button.context_menu.delete"),
        }),
      );

      menu.popup();
    } catch {
      // menu build error
    }
  };

  return {
    handleContextMenu,
    handleDelete,
    handleFavorite,
  };
};
