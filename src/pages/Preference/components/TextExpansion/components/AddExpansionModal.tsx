import { Form, Input, Modal, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DatabaseSchemaTextExpansion } from "@/types/database";

interface AddExpansionModalProps {
  open: boolean;
  editingExpansion?: DatabaseSchemaTextExpansion | null;
  onCancel: () => void;
  onSubmit: (
    triggerWord: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export const AddExpansionModal: React.FC<AddExpansionModalProps> = ({
  open,
  editingExpansion,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [triggerWordError, setTriggerWordError] = useState<string>();

  useEffect(() => {
    if (open) {
      if (editingExpansion) {
        form.setFieldsValue({
          content: editingExpansion.content,
          triggerWord: editingExpansion.triggerWord,
        });
      } else {
        form.resetFields();
      }
      setTriggerWordError(undefined);
    }
  }, [open, editingExpansion, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setTriggerWordError(undefined);

      const result = await onSubmit(values.triggerWord, values.content);

      if (result.success) {
        message.success(
          editingExpansion
            ? t("common.edit_success", "修改成功")
            : t("common.add_success", "添加成功"),
        );
        onCancel();
      } else {
        setTriggerWordError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      afterClose={() => form.resetFields()}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={handleSubmit}
      open={open}
      title={
        editingExpansion
          ? t("preference.text_expansion.edit", "编辑快捷粘贴")
          : t("preference.text_expansion.add", "添加快捷粘贴")
      }
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          help={triggerWordError}
          label={t("preference.text_expansion.trigger_word", "快捷词")}
          name="triggerWord"
          rules={[
            {
              message: t(
                "preference.text_expansion.trigger_word_required",
                "请输入快捷词",
              ),
              required: true,
            },
            {
              max: 50,
              message: t(
                "preference.text_expansion.trigger_word_max",
                "快捷词最多50个字符",
              ),
            },
          ]}
          validateStatus={triggerWordError ? "error" : undefined}
        >
          <Input
            onChange={() => setTriggerWordError(undefined)}
            placeholder={t(
              "preference.text_expansion.trigger_word_placeholder",
              "如: u123",
            )}
          />
        </Form.Item>
        <Form.Item
          label={t("preference.text_expansion.content", "展开内容")}
          name="content"
          rules={[
            {
              message: t(
                "preference.text_expansion.content_required",
                "请输入展开内容",
              ),
              required: true,
            },
          ]}
        >
          <Input.TextArea
            placeholder={t(
              "preference.text_expansion.content_placeholder",
              "输入要展开的内容,支持变量如 {date}",
            )}
            rows={4}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
