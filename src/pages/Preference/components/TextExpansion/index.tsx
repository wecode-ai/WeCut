import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { listen } from "@tauri-apps/api/event";
import { Button, Empty, Input, Popconfirm, Switch, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import {
  textExpansionActions,
  textExpansionStore,
} from "@/stores/textExpansion";
import type { DatabaseSchemaTextExpansion } from "@/types/database";
import { AddExpansionModal } from "./components/AddExpansionModal";
import styles from "./index.module.scss";

const TEXT_EXPANSION_CHANGED = "text-expansion:changed";

const TextExpansion = () => {
  const { t } = useTranslation();
  const snapshot = useSnapshot(textExpansionStore);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpansion, setEditingExpansion] =
    useState<DatabaseSchemaTextExpansion | null>(null);

  useEffect(() => {
    textExpansionActions.loadExpansions();

    // Listen for changes from other windows
    const unlisten = listen(TEXT_EXPANSION_CHANGED, () => {
      textExpansionActions.loadExpansions();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleAdd = () => {
    setEditingExpansion(null);
    setModalOpen(true);
  };

  const handleEdit = (expansion: DatabaseSchemaTextExpansion) => {
    setEditingExpansion({ ...expansion });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await textExpansionActions.deleteExpansion(id);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingExpansion(null);
  };

  const handleSubmit = async (
    triggerWord: string,
    content: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (editingExpansion) {
      return await textExpansionActions.updateExpansion(
        editingExpansion.id,
        triggerWord,
        content,
      );
    }
    return await textExpansionActions.addExpansion(triggerWord, content);
  };

  return (
    <>
      <ProList header={t("preference.text_expansion.title", "快捷粘贴")}>
        {/* 启用开关 */}
        <ProListItem
          description={t(
            "preference.text_expansion.enabled_desc",
            "开启后输入前缀+快捷词可自动展开内容",
          )}
          title={t("preference.text_expansion.enabled", "启用快捷粘贴")}
        >
          <Switch
            checked={snapshot.enabled}
            onChange={textExpansionActions.setEnabled}
          />
        </ProListItem>

        {/* 前缀设置 */}
        <ProListItem
          description={t(
            "preference.text_expansion.prefix_hint",
            '默认: ;; (如输入 ";;u123" 触发)',
          )}
          title={t("preference.text_expansion.prefix", "匹配前缀")}
        >
          <Input
            disabled={!snapshot.enabled}
            onChange={(e) => textExpansionActions.setPrefix(e.target.value)}
            placeholder=";;"
            style={{ textAlign: "center", width: 100 }}
            value={snapshot.prefix}
          />
        </ProListItem>
      </ProList>

      {/* 快捷粘贴列表 */}
      <ProList
        footer={
          <Button
            block
            disabled={!snapshot.enabled}
            icon={<PlusOutlined />}
            onClick={handleAdd}
            type="dashed"
          >
            {t("preference.text_expansion.add", "添加快捷粘贴")}
          </Button>
        }
        header={`${t("preference.text_expansion.list", "快捷粘贴列表")} (${snapshot.expansions.length})`}
      >
        {snapshot.expansions.length === 0 ? (
          <Empty
            className={styles.empty}
            description={t(
              "preference.text_expansion.empty",
              "暂无快捷粘贴，点击下方按钮创建",
            )}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          snapshot.expansions.map((expansion) => {
            const contentPreview =
              expansion.content.length > 60
                ? `${expansion.content.slice(0, 60)}...`
                : expansion.content;

            return (
              <ProListItem
                avatar={
                  <Tag className={styles.triggerTag} color="blue">
                    {snapshot.prefix}
                    {expansion.triggerWord}
                  </Tag>
                }
                description={contentPreview}
                key={expansion.id}
                title={
                  <span className={styles.triggerWord}>
                    {expansion.triggerWord}
                  </span>
                }
              >
                <Button
                  disabled={!snapshot.enabled}
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(expansion)}
                  type="text"
                />
                <Popconfirm
                  cancelText={t("common.cancel", "取消")}
                  description={t(
                    "preference.text_expansion.delete_confirm",
                    "确定要删除这个快捷粘贴吗？",
                  )}
                  okText={t("common.confirm", "确认")}
                  onConfirm={() => handleDelete(expansion.id)}
                  title={t(
                    "preference.text_expansion.delete_title",
                    "确认删除",
                  )}
                >
                  <Button
                    danger
                    disabled={!snapshot.enabled}
                    icon={<DeleteOutlined />}
                    type="text"
                  />
                </Popconfirm>
              </ProListItem>
            );
          })
        )}
      </ProList>

      <AddExpansionModal
        editingExpansion={editingExpansion}
        onCancel={handleModalClose}
        onSubmit={handleSubmit}
        open={modalOpen}
      />
    </>
  );
};

export default TextExpansion;
