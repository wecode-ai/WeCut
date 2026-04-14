import { PlusOutlined } from "@ant-design/icons";
import { Menu, MenuItem, type MenuItemOptions } from "@tauri-apps/api/menu";
import { useKeyPress } from "ahooks";
import { Button, Input, Tag } from "antd";
import clsx from "clsx";
import { type MouseEvent, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import CreateTagModal from "@/components/CreateTagModal";
import Scrollbar from "@/components/Scrollbar";
import { clipboardStore, tagActions } from "@/stores/clipboard";
import type { DatabaseSchemaGroup, DatabaseSchemaTag } from "@/types/database";
import { scrollElementToCenter } from "@/utils/dom";
import { MainContext } from "../..";

const GroupList = () => {
  const { rootState } = useContext(MainContext);
  const { t } = useTranslation();
  const { tags, activeTagId } = useSnapshot(clipboardStore);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<DatabaseSchemaTag | null>(null);

  useEffect(() => {
    scrollElementToCenter(rootState.group);
  }, [rootState.group]);

  const presetGroups: DatabaseSchemaGroup[] = [
    {
      id: "all",
      name: t("clipboard.label.tab.all"),
    },
    {
      id: "text",
      name: t("clipboard.label.tab.text"),
    },
    {
      id: "image",
      name: t("clipboard.label.tab.image"),
    },
    {
      id: "files",
      name: t("clipboard.label.tab.files"),
    },
    {
      id: "favorite",
      name: t("clipboard.label.tab.favorite"),
    },
  ];

  // 合并预设标签和自定义标签
  const allGroups: (DatabaseSchemaGroup | DatabaseSchemaTag)[] = [
    ...presetGroups,
    ...tags,
  ];

  useKeyPress("tab", (event) => {
    const index = allGroups.findIndex((item) =>
      "color" in item
        ? item.id === activeTagId
        : item.id === rootState.group && !activeTagId,
    );
    const length = allGroups.length;

    let nextIndex = index;

    if (event.shiftKey) {
      nextIndex = index === 0 ? length - 1 : index - 1;
    } else {
      nextIndex = index === length - 1 ? 0 : index + 1;
    }

    const nextItem = allGroups[nextIndex];
    if ("color" in nextItem) {
      tagActions.setActiveTag(nextItem.id);
      rootState.group = "tag";
    } else {
      tagActions.setActiveTag(null);
      rootState.group = nextItem.id;
    }
  });

  return (
    <>
      <Scrollbar className="flex" data-tauri-drag-region>
        {allGroups.map((item) => {
          const isTag = "color" in item;
          const id = item.id;
          const name = item.name;
          const isChecked = isTag
            ? item.id === activeTagId
            : item.id === rootState.group && !activeTagId;

          const isEditing = editingTag?.id === id;

          const handleDoubleClick = () => {
            if (isTag) {
              setEditingTag(item as DatabaseSchemaTag);
            }
          };

          const handleEditSave = async () => {
            if (editingTag?.name.trim()) {
              await tagActions.update(editingTag.id, {
                name: editingTag.name.trim(),
              });
            }
            setEditingTag(null);
          };

          const handleEditCancel = () => {
            setEditingTag(null);
          };

          const handleEditKeyDown = (
            event: React.KeyboardEvent<HTMLInputElement>,
          ) => {
            if (event.key === "Enter") {
              handleEditSave();
            } else if (event.key === "Escape") {
              handleEditCancel();
            }
          };

          const handleContextMenu = async (event: MouseEvent) => {
            if (!isTag) return;
            event.preventDefault();
            event.stopPropagation();

            try {
              const items: MenuItemOptions[] = [
                {
                  action: () => setEditingTag(item as DatabaseSchemaTag),
                  text: t("tag.rename", "重命名"),
                },
                {
                  action: async () => {
                    await tagActions.delete(item.id);
                  },
                  text: t("tag.delete", "删除"),
                },
              ];

              const menu = await Menu.new();

              for (const menuItem of items) {
                await menu.append(await MenuItem.new(menuItem));
              }

              await menu.popup();
            } catch {
              // menu build error
            }
          };

          return (
            <div
              id={id}
              key={id}
              onContextMenu={handleContextMenu}
              onDoubleClick={handleDoubleClick}
            >
              <Tag.CheckableTag
                checked={isChecked}
                className={clsx({ "bg-primary!": isChecked })}
                onChange={() => {
                  if (isEditing) return;
                  if (isTag) {
                    tagActions.setActiveTag(item.id);
                    rootState.group = "tag";
                  } else {
                    tagActions.setActiveTag(null);
                    rootState.group = id;
                  }
                }}
                style={
                  isTag && isChecked ? { backgroundColor: item.color } : {}
                }
              >
                <span style={{ alignItems: "center", display: "flex", gap: 4 }}>
                  {isTag && (
                    <span
                      style={{
                        backgroundColor: item.color,
                        borderRadius: "50%",
                        height: 8,
                        width: 8,
                      }}
                    />
                  )}
                  {isEditing ? (
                    <Input
                      autoFocus
                      onBlur={handleEditSave}
                      onChange={(e) =>
                        setEditingTag({ ...editingTag, name: e.target.value })
                      }
                      onKeyDown={handleEditKeyDown}
                      size="small"
                      style={{ width: 100 }}
                      value={editingTag?.name || ""}
                    />
                  ) : (
                    name
                  )}
                </span>
              </Tag.CheckableTag>
            </div>
          );
        })}
      </Scrollbar>

      <Button
        icon={<PlusOutlined />}
        onClick={() => setCreateModalOpen(true)}
        size="small"
        title={t("tag.create", "新建标签")}
        type="text"
      />

      <CreateTagModal
        onClose={() => setCreateModalOpen(false)}
        open={createModalOpen}
      />
    </>
  );
};

export default GroupList;
