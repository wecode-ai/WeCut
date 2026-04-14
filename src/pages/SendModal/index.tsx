import { useMount } from "ahooks";
import { ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { LISTEN_KEY } from "@/constants";
import { useTauriListen } from "@/hooks/useTauriListen";
import { getAntdLocale, i18n } from "@/locales";
import { listenSendModalData } from "@/plugins/sendModal";
import { clipboardStore } from "@/stores/clipboard";
import { globalStore } from "@/stores/global";
import type { Store } from "@/types/store";
import { deepAssign } from "@/utils/object";
import AiChatForm from "./components/AiChatForm";
import Header from "./components/Header";
import WorkQueueForm from "./components/WorkQueueForm";
import "./index.scss";

const { defaultAlgorithm, darkAlgorithm } = theme;

const SendModal = () => {
  const { appearance } = useSnapshot(globalStore);
  const [ready, setReady] = useState(false);
  const [serviceType, setServiceType] = useState<string>("aiChat");

  // 初始化
  useMount(() => {
    // 设置语言
    i18n.changeLanguage(appearance.language);

    setReady(true);
  });

  // 监听配置变化，从 Preference 窗口同步最新配置
  useTauriListen<Store>(LISTEN_KEY.STORE_CHANGED, ({ payload }) => {
    deepAssign(globalStore, payload.globalStore);
    deepAssign(clipboardStore, payload.clipboardStore);
  });

  // 监听 send-modal-data 事件，获取 serviceType
  useEffect(() => {
    const unlisten = listenSendModalData((data) => {
      if (data.serviceType) {
        setServiceType(data.serviceType);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (!ready) {
    return null;
  }

  const isAiChat = serviceType === "aiChat";

  return (
    <ConfigProvider
      locale={getAntdLocale(appearance.language)}
      theme={{
        algorithm: appearance.isDark ? darkAlgorithm : defaultAlgorithm,
      }}
    >
      <div className={`send-modal-window ${appearance.isDark ? "dark" : ""}`}>
        <Header
          isAiChat={isAiChat}
          title={isAiChat ? "发送到 AI Chat" : "发送到工作队列"}
        />

        <div className="send-modal-content">
          {isAiChat ? <AiChatForm /> : <WorkQueueForm />}
        </div>
      </div>
    </ConfigProvider>
  );
};

export default SendModal;
