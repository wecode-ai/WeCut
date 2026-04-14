import { Collapse, Form, Input, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { clipboardStore } from "@/stores/clipboard";

const { Panel } = Collapse;

interface WorkQueueFormProps {
  form: any;
  contentPreview: string;
}

const WorkQueueForm = ({ form, contentPreview }: WorkQueueFormProps) => {
  const { t } = useTranslation();
  const { workQueueConfig } = useSnapshot(clipboardStore);

  useEffect(() => {
    // 设置初始值
    form.setFieldsValue({
      content: contentPreview,
      note: workQueueConfig?.defaults?.note || "",
      priority: workQueueConfig?.defaults?.priority || "normal",
      senderDisplayName: workQueueConfig?.defaults?.sender?.displayName || "",
      senderExternalId: workQueueConfig?.defaults?.sender?.externalId || "",
      sourceName: workQueueConfig?.defaults?.source?.name || "",
      sourceType: workQueueConfig?.defaults?.source?.type || "api",
      title: workQueueConfig?.defaults?.title || "",
    });
  }, [form, contentPreview, workQueueConfig]);

  return (
    <Form form={form} layout="vertical">
      <Form.Item
        label={t("component.send_modal.work_queue.label.content")}
        name="content"
        rules={[
          {
            message: t(
              "component.send_modal.work_queue.validation.content_required",
            ),
            required: true,
          },
        ]}
      >
        <Input.TextArea
          autoComplete="off"
          placeholder={t("component.send_modal.work_queue.placeholder.content")}
          rows={3}
        />
      </Form.Item>

      <Form.Item
        label={t("component.send_modal.work_queue.label.title")}
        name="title"
      >
        <Input
          autoComplete="off"
          placeholder={t(
            "component.send_modal.work_queue.placeholder.optional",
          )}
        />
      </Form.Item>

      <Form.Item
        label={t("component.send_modal.work_queue.label.note")}
        name="note"
      >
        <Input
          autoComplete="off"
          placeholder={t(
            "component.send_modal.work_queue.placeholder.optional",
          )}
        />
      </Form.Item>

      <Form.Item
        label={t("component.send_modal.work_queue.label.priority")}
        name="priority"
      >
        <Select
          options={[
            {
              label: t("component.send_modal.work_queue.priority.normal"),
              value: "normal",
            },
            {
              label: t("component.send_modal.work_queue.priority.high"),
              value: "high",
            },
            {
              label: t("component.send_modal.work_queue.priority.low"),
              value: "low",
            },
          ]}
          style={{ width: 140 }}
        />
      </Form.Item>

      <Collapse ghost>
        <Panel
          header={t("component.send_modal.work_queue.advanced_options")}
          key="1"
        >
          <Form.Item
            label={t(
              "component.send_modal.work_queue.label.sender_external_id",
            )}
            name="senderExternalId"
          >
            <Input
              autoComplete="off"
              placeholder={t(
                "component.send_modal.work_queue.placeholder.external_id",
              )}
            />
          </Form.Item>

          <Form.Item
            label={t(
              "component.send_modal.work_queue.label.sender_display_name",
            )}
            name="senderDisplayName"
          >
            <Input
              autoComplete="off"
              placeholder={t(
                "component.send_modal.work_queue.placeholder.display_name",
              )}
            />
          </Form.Item>

          <Form.Item
            label={t("component.send_modal.work_queue.label.source_type")}
            name="sourceType"
          >
            <Input
              autoComplete="off"
              placeholder={t(
                "component.send_modal.work_queue.placeholder.source_type",
              )}
            />
          </Form.Item>

          <Form.Item
            label={t("component.send_modal.work_queue.label.source_name")}
            name="sourceName"
          >
            <Input
              autoComplete="off"
              placeholder={t(
                "component.send_modal.work_queue.placeholder.source_name",
              )}
            />
          </Form.Item>
        </Panel>
      </Collapse>
    </Form>
  );
};

export default WorkQueueForm;
