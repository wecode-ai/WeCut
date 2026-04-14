import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProList from "@/components/ProList";
import ProShortcut from "@/components/ProShortcut";
import { globalStore } from "@/stores/global";
import Preset from "./components/Preset";
import QuickPaste from "./components/QuickPaste";

const Shortcut = () => {
  const { shortcut } = useSnapshot(globalStore);
  const { t } = useTranslation();

  return (
    <>
      <ProList header={t("preference.shortcut.shortcut.title")}>
        <ProShortcut
          onChange={(value) => {
            globalStore.shortcut.clipboard = value;
          }}
          title={t("preference.shortcut.shortcut.label.open_clipboard")}
          value={shortcut.clipboard}
        />

        <ProShortcut
          onChange={(value) => {
            globalStore.shortcut.preference = value;
          }}
          title={t("preference.shortcut.shortcut.label.open_settings")}
          value={shortcut.preference}
        />

        <ProShortcut
          description={t("preference.shortcut.shortcut.hints.screenshot")}
          onChange={(value) => {
            globalStore.shortcut.screenshot = value;
          }}
          title={t("preference.shortcut.shortcut.label.screenshot")}
          value={shortcut.screenshot || ""}
        />

        <QuickPaste />

        <ProShortcut
          description={t("preference.shortcut.shortcut.hints.paste_as_plain")}
          isSystem={false}
          onChange={(value) => {
            globalStore.shortcut.pastePlain = value;
          }}
          title={t("preference.shortcut.shortcut.label.paste_as_plain")}
          value={shortcut.pastePlain}
        />

        <ProShortcut
          description={t("preference.shortcut.shortcut.hints.copy_file_path")}
          isSystem={false}
          onChange={(value) => {
            globalStore.shortcut.copyFilePath = value;
          }}
          title={t("preference.shortcut.shortcut.label.copy_file_path")}
          value={shortcut.copyFilePath}
        />

        {/* Wegent 发送快捷键配置 */}
        <div className="px-4 py-2 font-medium text-color-3 text-sm">
          {t("preference.shortcut.shortcut.label.wegent_group", "Wegent 发送")}
        </div>

        <ProShortcut
          description={t("preference.shortcut.shortcut.hints.send_ai_chat")}
          isSystem={false}
          onChange={(value) => {
            if (!globalStore.shortcut.wegent) {
              globalStore.shortcut.wegent = { aiChat: "", workQueue: "" };
            }
            globalStore.shortcut.wegent.aiChat = value;
          }}
          title={t("preference.shortcut.shortcut.label.send_ai_chat")}
          value={shortcut.wegent?.aiChat || ""}
        />

        <ProShortcut
          description={t("preference.shortcut.shortcut.hints.send_work_queue")}
          isSystem={false}
          onChange={(value) => {
            if (!globalStore.shortcut.wegent) {
              globalStore.shortcut.wegent = { aiChat: "", workQueue: "" };
            }
            globalStore.shortcut.wegent.workQueue = value;
          }}
          title={t("preference.shortcut.shortcut.label.send_work_queue")}
          value={shortcut.wegent?.workQueue || ""}
        />

        {/* 兼容旧配置 */}
        {shortcut.send && (
          <ProShortcut
            description={t("preference.shortcut.shortcut.hints.send")}
            isSystem={false}
            onChange={(value) => {
              globalStore.shortcut.send = value;
            }}
            title={t("preference.shortcut.shortcut.label.send")}
            value={shortcut.send}
          />
        )}
      </ProList>

      <Preset />
    </>
  );
};

export default Shortcut;
