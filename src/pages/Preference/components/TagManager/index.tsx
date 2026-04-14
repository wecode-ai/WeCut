import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Popconfirm } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import CreateTagModal from "@/components/CreateTagModal";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import { clipboardStore, tagActions } from "@/stores/clipboard";
import type { DatabaseSchemaTag } from "@/types/database";

const TagManager = () => {
  const { t } = useTranslation();
  const { tags } = useSnapshot(clipboardStore);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<DatabaseSchemaTag | undefined>();

  useEffect(() => {
    tagActions.loadTags();
  }, []);

  const handleCreate = () => {
    setEditingTag(undefined);
    setModalOpen(true);
  };

  const handleEdit = (tag: DatabaseSchemaTag) => {
    setEditingTag({ ...tag });
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingTag(undefined);
  };

  return (
    <ProList
      footer={
        <Button
          block
          icon={<PlusOutlined />}
          onClick={handleCreate}
          type="dashed"
        >
          {t("tag.create", "新建标签")}
        </Button>
      }
      header={t("tag.manager_title", "标签管理")}
    >
      {tags.length === 0 ? (
        <Empty
          className="py-8"
          description={t("tag.empty", "暂无标签，点击下方按钮创建")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        tags.map((tag) => (
          <ProListItem
            key={tag.id}
            title={
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </span>
            }
          >
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEdit(tag)}
              type="text"
            />
            <Popconfirm
              cancelText={t("common.cancel", "取消")}
              description={t(
                "tag.delete_confirm_desc",
                "删除后该标签下的记录将不再关联此标签",
              )}
              okText={t("common.confirm", "确认")}
              onConfirm={() => tagActions.delete(tag.id)}
              title={t("tag.delete_confirm_title", "确认删除")}
            >
              <Button danger icon={<DeleteOutlined />} type="text" />
            </Popconfirm>
          </ProListItem>
        ))
      )}

      <CreateTagModal
        onClose={handleModalClose}
        open={modalOpen}
        tag={editingTag}
      />
    </ProList>
  );
};

export default TagManager;
