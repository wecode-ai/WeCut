import { openUrl } from "@tauri-apps/plugin-opener";
import { useBoolean } from "ahooks";
import { Button, Flex, Modal, Space } from "antd";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import LazyInput from "@/components/LazyInput";
import LazyPassword from "@/components/LazyInput/LazyPassword";
import LazyTextArea from "@/components/LazyInput/LazyTextArea";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import { clipboardStore } from "@/stores/clipboard";
import { DEFAULTS } from "@/utils/envConfig";

const API_KEY_URL = DEFAULTS.API_KEY_URL;

const AiChatSettings = () => {
  const { t } = useTranslation();
  const { wegent, aiChatConfig } = useSnapshot(clipboardStore);
  const [headerModalOpen, { toggle: toggleHeaderModal }] = useBoolean(false);

  // 获取当前配置（优先使用新的 wegent 配置）
  const config = wegent?.aiChat || aiChatConfig;

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

  const handleBaseUrlChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.aiChat.baseUrl = value;
  };

  const handleApiKeyChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.aiChat.apiKey = value;
  };

  const handleModelChange = (value: string) => {
    ensureWegentConfig();
    clipboardStore.wegent!.aiChat.model = value;
  };

  const handleCustomHeadersChange = (headersStr: string) => {
    try {
      const headers = headersStr ? JSON.parse(headersStr) : {};
      ensureWegentConfig();
      clipboardStore.wegent!.aiChat.customHeaders = headers;
    } catch (_e) {
      // 无效的 JSON，忽略
    }
  };

  const openApiKeyPage = async () => {
    await openUrl(API_KEY_URL);
  };

  return (
    <>
      <ProList header={t("preference.wegent.ai_chat.config_title")}>
        <ProListItem
          description={t("preference.wegent.ai_chat.hints.base_url")}
          title={t("preference.wegent.ai_chat.label.base_url")}
        >
          <LazyInput
            onChange={handleBaseUrlChange}
            placeholder={DEFAULTS.AI_CHAT_URL}
            style={{ width: 320 }}
            value={config?.baseUrl || DEFAULTS.AI_CHAT_URL}
          />
        </ProListItem>

        <ProListItem
          description={
            <Space direction="vertical" size={4}>
              <span>{t("preference.wegent.ai_chat.hints.api_key")}</span>
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
          title={t("preference.wegent.ai_chat.label.api_key")}
        >
          <LazyPassword
            onChange={handleApiKeyChange}
            placeholder="wg-..."
            style={{ width: 320 }}
            value={config?.apiKey}
          />
        </ProListItem>

        <ProListItem
          description={t("preference.wegent.ai_chat.hints.model")}
          title={t("preference.wegent.ai_chat.label.model")}
        >
          <LazyInput
            onChange={handleModelChange}
            placeholder={DEFAULTS.AI_MODEL}
            style={{ width: 280 }}
            value={config?.model || DEFAULTS.AI_MODEL}
          />
        </ProListItem>

        <ProListItem
          description={t("preference.wegent.ai_chat.hints.custom_headers")}
          title={t("preference.wegent.ai_chat.label.custom_headers")}
        >
          <Button onClick={toggleHeaderModal}>
            {t("preference.wegent.button.configure_headers")}
          </Button>
        </ProListItem>
      </ProList>

      <Modal
        centered
        footer={null}
        onCancel={toggleHeaderModal}
        open={headerModalOpen}
        title={t("preference.wegent.modal.custom_headers_title")}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <LazyTextArea
            onChange={handleCustomHeadersChange}
            placeholder='{"X-Custom-Header": "value"}'
            rows={6}
            value={JSON.stringify(config?.customHeaders || {}, null, 2)}
          />
          <Flex justify="flex-end">
            <Button onClick={toggleHeaderModal} type="primary">
              {t("preference.ai_send.button.confirm")}
            </Button>
          </Flex>
        </Space>
      </Modal>
    </>
  );
};

export default AiChatSettings;
