import { Flex, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { tagActions } from "@/stores/clipboard";
import type { DatabaseSchemaTag } from "@/types/database";

const PRESET_COLORS = [
  "#FF4D4D",
  "#FF8C42",
  "#FFD93D",
  "#6BCB77",
  "#4D96FF",
  "#9B59B6",
  "#FF6B9D",
  "#00B8A9",
  "#8B5A3C",
  "#6C757D",
  "#2C3E50",
  "#E74C3C",
];

interface CreateTagModalProps {
  open: boolean;
  onClose: () => void;
  tag?: DatabaseSchemaTag;
}

const CreateTagModal = ({ open, onClose, tag }: CreateTagModalProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const isEdit = !!tag;

  useEffect(() => {
    if (open && tag) {
      setName(tag.name);
      setColor(tag.color);
    } else if (open) {
      setName("");
      setColor(PRESET_COLORS[0]);
    }
  }, [open, tag]);

  const handleOk = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      if (isEdit) {
        await tagActions.update(tag.id, { color, name: name.trim() });
      } else {
        await tagActions.create(name.trim(), color);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      confirmLoading={loading}
      okButtonProps={{ disabled: !name.trim() }}
      onCancel={onClose}
      onOk={handleOk}
      open={open}
      title={
        isEdit
          ? t("tag.edit_title", "编辑标签")
          : t("tag.create_title", "新建标签")
      }
    >
      <Flex gap="middle" vertical>
        <div>
          <div style={{ marginBottom: 8 }}>
            {t("tag.name_label", "标签名称")}
          </div>
          <Input
            autoFocus
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("tag.name_placeholder", "请输入标签名称")}
            showCount
            value={name}
          />
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>
            {t("tag.color_label", "标签颜色")}
          </div>
          <Flex gap="small" wrap>
            {PRESET_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  backgroundColor: c,
                  border:
                    color === c ? "3px solid #000" : "2px solid transparent",
                  borderRadius: "50%",
                  boxSizing: "border-box",
                  cursor: "pointer",
                  height: 28,
                  width: 28,
                }}
              />
            ))}
          </Flex>
        </div>
      </Flex>
    </Modal>
  );
};

export default CreateTagModal;
