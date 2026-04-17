import { Menu, MenuItem, type MenuItemOptions } from "@tauri-apps/api/menu";
import type { InputRef } from "antd";
import { Button, Input } from "antd";
import clsx from "clsx";
import {
  type FC,
  type MouseEvent,
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import UnoIcon from "@/components/UnoIcon";
import { useShortcut } from "@/contexts/ShortcutContext";
import { showWindow } from "@/plugins/window";
import { clipboardStore, tagActions } from "@/stores/clipboard";
import type {
  DatabaseSchemaGroupId,
  DatabaseSchemaTag,
} from "@/types/database";

export interface DockToolbarProps {
  group: DatabaseSchemaGroupId;
  search?: string;
  searchActive?: boolean;
  searchInputRef: MutableRefObject<InputRef | null>;
  onGroupChange: (group: DatabaseSchemaGroupId) => void;
  onSearchActiveChange: (active: boolean) => void;
  onSearchChange: (value?: string) => void;
}

const DockToolbar: FC<DockToolbarProps> = (props) => {
  const {
    group,
    search,
    searchActive,
    searchInputRef,
    onGroupChange,
    onSearchActiveChange,
    onSearchChange,
  } = props;
  const { t } = useTranslation();
  const { tags, activeTagId } = useSnapshot(clipboardStore);
  const [localSearchActive, setLocalSearchActive] = useState(Boolean(search));
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const tagEditInputRef = useRef<HTMLInputElement>(null);
  const isSearchActive = searchActive ?? localSearchActive;

  // 获取快捷键管理器
  const { pushContext, popContext } = useShortcut();

  const presetGroups = useMemo(
    () => [
      {
        id: "all" as DatabaseSchemaGroupId,
        name: t("clipboard.label.tab.all"),
      },
      {
        id: "text" as DatabaseSchemaGroupId,
        name: t("clipboard.label.tab.text"),
      },
      {
        id: "image" as DatabaseSchemaGroupId,
        name: t("clipboard.label.tab.image"),
      },
      {
        id: "files" as DatabaseSchemaGroupId,
        name: t("clipboard.label.tab.files"),
      },
      {
        id: "favorite" as DatabaseSchemaGroupId,
        name: t("clipboard.label.tab.favorite"),
      },
    ],
    [t],
  );

  const isGroupActive = (id: DatabaseSchemaGroupId) => {
    if (activeTagId) {
      return id === "tag";
    }
    return id === group;
  };

  useEffect(() => {
    if (!search) return;

    setLocalSearchActive(true);
    onSearchActiveChange(true);
  }, [search, onSearchActiveChange]);

  // 当进入标签编辑模式时，自动聚焦输入框
  useEffect(() => {
    if (editingTagId) {
      queueMicrotask(() => {
        tagEditInputRef.current?.focus();
      });
    }
  }, [editingTagId]);

  const focusInput = () => {
    setLocalSearchActive(true);
    onSearchActiveChange(true);

    queueMicrotask(() => {
      searchInputRef.current?.focus();
    });
  };

  const collapseSearch = () => {
    setLocalSearchActive(false);
    onSearchActiveChange(false);
    searchInputRef.current?.blur();
  };

  const handleTagContextMenu = async (
    event: MouseEvent,
    tag: DatabaseSchemaTag,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const items: MenuItemOptions[] = [
        {
          action: () => {
            setEditingTagId(tag.id);
            setEditName(tag.name);
          },
          text: t("tag.rename", "重命名"),
        },
        {
          action: async () => {
            await tagActions.delete(tag.id);
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

  const handleTagDoubleClick = (
    event: React.MouseEvent,
    tag: DatabaseSchemaTag,
  ) => {
    event.stopPropagation();
    setEditingTagId(tag.id);
    setEditName(tag.name);
  };

  return (
    <div className="flex items-center justify-center">
      <div className="flex min-h-10 w-full items-center justify-center gap-2 overflow-x-auto rounded-[999px] border border-white/80 bg-white/72 px-2 py-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isSearchActive ? (
          <Input
            allowClear
            autoCorrect="off"
            className="w-56 shrink-0"
            onBlur={() => {
              // 弹出 input 上下文，恢复数字键快捷键
              popContext("input");

              if (search) return;

              collapseSearch();
            }}
            onChange={(event) => {
              onSearchChange(event.target.value || void 0);
            }}
            onFocus={() => {
              // 推入 input 上下文，禁用数字键快捷键
              pushContext("input");
            }}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;

              event.preventDefault();

              if (search) {
                onSearchChange(void 0);

                return;
              }

              collapseSearch();
            }}
            placeholder={t("clipboard.hints.search_placeholder")}
            prefix={<UnoIcon name="i-lucide:search" />}
            ref={searchInputRef}
            size="small"
            value={search}
          />
        ) : (
          <Button
            className={clsx("shrink-0 rounded-full", {
              "text-primary": isSearchActive || Boolean(search),
            })}
            onClick={focusInput}
            size="small"
            title={t("clipboard.hints.search_placeholder")}
            type="text"
          >
            <UnoIcon name="i-lucide:search" />
          </Button>
        )}

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {presetGroups.map((item) => {
            const active = !activeTagId && isGroupActive(item.id);

            return (
              <button
                className={clsx(
                  "shrink-0 rounded-full px-3 py-1 text-xs transition",
                  active
                    ? "bg-primary text-white shadow-[0_10px_24px_rgba(59,130,246,0.28)] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(59,130,246,0.34)]"
                    : "border border-slate-200 bg-slate-50/90 text-color-2 hover:border-primary/30 hover:bg-white hover:text-color-1",
                )}
                key={item.id}
                onClick={() => {
                  tagActions.setActiveTag(null);
                  onGroupChange(item.id);
                }}
                type="button"
              >
                {item.name}
              </button>
            );
          })}
          {tags.map((tag) => {
            const active = activeTagId === tag.id;
            const isEditing = editingTagId === tag.id;

            if (isEditing) {
              return (
                <span
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 rounded-full border-2 border-primary px-2 py-1 text-xs transition",
                    active
                      ? "text-white shadow-[0_10px_24px_rgba(59,130,246,0.28)]"
                      : "bg-white text-color-1",
                  )}
                  key={tag.id}
                  style={active ? { backgroundColor: tag.color } : {}}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <input
                    className="!px-1 !py-0 !h-5 !min-h-0 !text-xs !w-20 !bg-transparent !border-0 !rounded-none focus:!ring-0 focus:outline-none"
                    onBlur={async () => {
                      // 弹出 input 上下文，恢复数字键快捷键
                      popContext("input");

                      if (editName.trim()) {
                        await tagActions.update(tag.id, {
                          name: editName.trim(),
                        });
                      }
                      setEditingTagId(null);
                      setEditName("");
                    }}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => {
                      // 推入 input 上下文，禁用数字键快捷键
                      pushContext("input");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        // ESC 取消编辑，恢复原名称
                        setEditingTagId(null);
                        setEditName("");
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (editName.trim()) {
                          tagActions
                            .update(tag.id, {
                              name: editName.trim(),
                            })
                            .then(() => {
                              setEditingTagId(null);
                              setEditName("");
                            });
                        } else {
                          setEditingTagId(null);
                          setEditName("");
                        }
                      }
                    }}
                    ref={tagEditInputRef}
                    value={editName}
                  />
                </span>
              );
            }

            return (
              <button
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs transition",
                  active
                    ? "text-white shadow-[0_10px_24px_rgba(59,130,246,0.28)] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(59,130,246,0.34)]"
                    : "border border-slate-200 bg-slate-50/90 text-color-2 hover:border-primary/30 hover:bg-white hover:text-color-1",
                )}
                key={tag.id}
                onClick={() => {
                  tagActions.setActiveTag(tag.id);
                  onGroupChange("tag" as DatabaseSchemaGroupId);
                }}
                onContextMenu={(e) => handleTagContextMenu(e, tag)}
                onDoubleClick={(e) => handleTagDoubleClick(e, tag)}
                style={active ? { backgroundColor: tag.color } : {}}
                type="button"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            );
          })}
        </div>

        <Button
          className="ml-auto shrink-0 rounded-full text-color-3"
          onClick={async () => {
            const newTag = await tagActions.create("未命名", "#FF4D4D");
            setEditingTagId(newTag.id);
            setEditName(newTag.name);
            tagActions.setActiveTag(newTag.id);
            onGroupChange("tag" as DatabaseSchemaGroupId);
          }}
          size="small"
          title={t("tag.create", "新建标签")}
          type="text"
        >
          <UnoIcon name="i-lucide:plus" />
        </Button>

        <Button
          className="shrink-0 rounded-full text-color-3"
          onClick={() => {
            showWindow("preference");
          }}
          size="small"
          title="More"
          type="text"
        >
          <UnoIcon name="i-lucide:ellipsis" />
        </Button>
      </div>
    </div>
  );
};

export default DockToolbar;
