import { openUrl } from "@tauri-apps/plugin-opener";
import { Button, Select, Space } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import LazyInput from "@/components/LazyInput";
import LazyPassword from "@/components/LazyInput/LazyPassword";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import { clipboardStore } from "@/stores/clipboard";
import { DEFAULTS } from "@/utils/envConfig";
import { fetchWorkQueues, type WorkQueueItem } from "@/utils/send";

const API_KEY_URL = DEFAULTS.API_KEY_URL;

const WorkQueueSettings = () => {
  const { t } = useTranslation();
  const { wegent, workQueueConfig } = useSnapshot(clipboardStore);

  // 获取当前配置（优先使用新的 wegent 配置）
  const config = wegent?.workQueue || workQueueConfig;

  // 提取原始值，避免 valtio proxy 在 useCallback 依赖中的问题
  const baseUrl = config?.baseUrl || DEFAULTS.WORK_QUEUE_URL;
  const apiToken = config?.apiToken || "";

  const [queues, setQueues] = useState<WorkQueueItem[]>([]);
  const [loadingQueues, setLoadingQueues] = useState(false);

  const ensureWegentConfig = () => {
    if (!clipboardStore.wegent) {
      clipboardStore.wegent = {
        aiChat: {
          apiKey: "",
          baseUrl: DEFAULTS.AI_CHAT_URL,
          customHeaders: {},
          enabled: true,
          model: DEFAULTS.AI_MODEL,
        },
        workQueue: {
          apiToken: "",
          baseUrl: DEFAULTS.WORK_QUEUE_URL,
          defaults: { note: "", title: "" },
          enabled: false,
          queueName: "",
        },
      };
    }
  };

  const loadQueues = useCallback(async () => {
    if (!baseUrl || !apiToken) {
      setQueues([]);
      return;
    }
    setLoadingQueues(true);
    try {
      const result = await fetchWorkQueues(baseUrl, apiToken);
      setQueues(result);
    } finally {
      setLoadingQueues(false);
    }
  }, [baseUrl, apiToken]);

  // 当 baseUrl 或 apiToken 变化时自动加载队列列表
  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const openApiKeyPage = async () => {
    await openUrl(API_KEY_URL);
  };

  const handleBaseUrlChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.workQueue.baseUrl = value;
  };

  const handleApiTokenChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.workQueue.apiToken = value;
  };

  const handleQueueNameChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.workQueue.queueName = value;
  };

  const handleDefaultTitleChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.workQueue.defaults.title = value;
  };

  const handleDefaultNoteChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.workQueue.defaults.note = value;
  };

  const queueOptions = queues.map((q) => ({
    label: q.displayName || q.name,
    value: q.name,
  }));

  return (
    <>
      <ProList header={t("preference.wegent.work_queue.config_title")}>
        <ProListItem
          description={t("preference.wegent.work_queue.hints.base_url")}
          title={t("preference.wegent.work_queue.label.base_url")}
        >
          <LazyInput
            onChange={handleBaseUrlChange}
            placeholder={DEFAULTS.WORK_QUEUE_URL}
            style={{ width: 320 }}
            value={config?.baseUrl || DEFAULTS.WORK_QUEUE_URL}
          />
        </ProListItem>

        <ProListItem
          description={
            <Space direction="vertical" size={4}>
              <span>{t("preference.wegent.work_queue.hints.api_token")}</span>
              <Button
                onClick={openApiKeyPage}
                size="small"
                style={{ marginLeft: 0, paddingLeft: 0 }}
                type="link"
              >
                {t("preference.wegent.button.apply_api_key")} →
              </Button>
            </Space>
          }
          title={t("preference.wegent.work_queue.label.api_token")}
        >
          <LazyPassword
            onChange={handleApiTokenChange}
            placeholder="wg-..."
            style={{ width: 320 }}
            value={config?.apiToken}
          />
        </ProListItem>

        <ProListItem
          description={t("preference.wegent.work_queue.hints.queue_name")}
          title={t("preference.wegent.work_queue.label.queue_name")}
        >
          <Space>
            <Select
              allowClear
              loading={loadingQueues}
              onChange={handleQueueNameChange}
              options={queueOptions}
              placeholder="my-queue"
              style={{ width: 240 }}
              value={config?.queueName || undefined}
            />
            <Button
              loading={loadingQueues}
              onClick={loadQueues}
              size="small"
              title={t(
                "preference.wegent.work_queue.button.refresh_queues",
                "刷新队列列表",
              )}
            >
              {t("preference.wegent.work_queue.button.refresh_queues", "刷新")}
            </Button>
          </Space>
        </ProListItem>
      </ProList>

      <ProList header={t("preference.wegent.work_queue.defaults_title")}>
        <ProListItem
          description={t("preference.wegent.work_queue.hints.default_title")}
          title={t("preference.wegent.work_queue.label.default_title")}
        >
          <LazyInput
            onChange={handleDefaultTitleChange}
            placeholder={t("preference.wegent.work_queue.placeholder.optional")}
            style={{ width: 280 }}
            value={config?.defaults?.title}
          />
        </ProListItem>

        <ProListItem
          description={t("preference.wegent.work_queue.hints.default_note")}
          title={t("preference.wegent.work_queue.label.default_note")}
        >
          <LazyInput
            onChange={handleDefaultNoteChange}
            placeholder={t("preference.wegent.work_queue.placeholder.optional")}
            style={{ width: 280 }}
            value={config?.defaults?.note}
          />
        </ProListItem>
      </ProList>
    </>
  );
};

export default WorkQueueSettings;
