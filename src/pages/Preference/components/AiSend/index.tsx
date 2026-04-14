import { Space } from "antd";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProList from "@/components/ProList";
import ProSwitch from "@/components/ProSwitch";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import { DEFAULTS } from "@/utils/envConfig";
import AiChatSettings from "./components/AiChatSettings";
import WorkQueueSettings from "./components/WorkQueueSettings";

const AiSend = () => {
  const { t } = useTranslation();
  const { wegent } = useSnapshot(clipboardStore);
  const { env } = useSnapshot(globalStore);

  const handleAiChatEnabledChange = (value: boolean) => {
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
    clipboardStore.wegent.aiChat.enabled = value;
  };

  const handleWorkQueueEnabledChange = (value: boolean) => {
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
    clipboardStore.wegent.workQueue.enabled = value;
  };

  const aiChatEnabled = wegent?.aiChat?.enabled ?? false;
  const workQueueEnabled = wegent?.workQueue?.enabled ?? false;

  // WegentChat 仅在环境变量开启时显示
  const showWegentChat = env.features?.wegentChat ?? false;

  return (
    <>
      {/* WegentChat 配置 - 仅在环境变量开启时显示 */}
      {showWegentChat && (
        <>
          <ProList header={t("preference.wegent.settings.title")}>
            <ProSwitch
              description={t("preference.wegent.settings.hints.enable_ai_chat")}
              onChange={handleAiChatEnabledChange}
              title={t("preference.wegent.settings.label.enable_ai_chat")}
              value={aiChatEnabled}
            />
          </ProList>

          {aiChatEnabled && <AiChatSettings />}
        </>
      )}

      {/* Wegent待办 配置 */}
      <ProList
        header={<Space>{t("preference.wegent.work_queue.config_title")}</Space>}
      >
        <ProSwitch
          description={t("preference.wegent.settings.hints.enable_work_queue")}
          onChange={handleWorkQueueEnabledChange}
          title={t("preference.wegent.settings.label.enable_work_queue")}
          value={workQueueEnabled}
        />
      </ProList>

      {workQueueEnabled && <WorkQueueSettings />}
    </>
  );
};

export default AiSend;
