import { Menu, type MenuProps } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { hasTag } from "@/database/tag";
import { clipboardStore, tagActions } from "@/stores/clipboard";
import type { DatabaseSchemaTag } from "@/types/database";

interface TagSubMenuProps {
  historyId: string;
  onManageTags?: () => void;
  onClose?: () => void;
}

const TagSubMenu = ({ historyId, onManageTags, onClose }: TagSubMenuProps) => {
  const { t } = useTranslation();
  const { tags } = useSnapshot(clipboardStore);
  const [checkedTags, setCheckedTags] = useState<Set<string>>(new Set());
  const [, setLoading] = useState(true);

  // 加载当前历史项的标签状态
  useEffect(() => {
    const loadCheckedTags = async () => {
      setLoading(true);
      const checked = new Set<string>();
      for (const tag of tags) {
        if (await hasTag(historyId, tag.id)) {
          checked.add(tag.id);
        }
      }
      setCheckedTags(checked);
      setLoading(false);
    };

    if (historyId) {
      loadCheckedTags();
    }
  }, [historyId, tags]);

  const handleTagClick = async (tag: DatabaseSchemaTag) => {
    const isChecked = checkedTags.has(tag.id);

    if (isChecked) {
      await tagActions.removeTagFromHistory(historyId, tag.id);
      setCheckedTags((prev) => {
        const next = new Set(prev);
        next.delete(tag.id);
        return next;
      });
    } else {
      await tagActions.addTagToHistory(historyId, tag.id);
      setCheckedTags((prev) => new Set([...prev, tag.id]));
    }
    // 点击标签后关闭菜单
    onClose?.();
  };

  const items: MenuProps["items"] = [
    {
      key: "favorite",
      label: t("tag.default_favorite", "默认收藏"),
    },
  ];

  // 添加分隔线和标签列表
  if (tags.length > 0) {
    items.push({
      key: "divider1",
      type: "divider",
    });

    for (const tag of tags) {
      items.push({
        icon: checkedTags.has(tag.id) ? "✓" : null,
        key: tag.id,
        label: (
          <span style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <span
              style={{
                backgroundColor: tag.color,
                borderRadius: "50%",
                height: 8,
                width: 8,
              }}
            />
            {tag.name}
          </span>
        ),
        onClick: () => handleTagClick(tag),
      });
    }
  }

  // 添加管理标签选项
  items.push(
    {
      key: "divider2",
      type: "divider",
    },
    {
      key: "manage",
      label: t("tag.manage_tags", "管理标签..."),
      onClick: () => {
        onManageTags?.();
        onClose?.();
      },
    },
  );

  return <Menu items={items} selectable={false} style={{ minWidth: 160 }} />;
};

export default TagSubMenu;
