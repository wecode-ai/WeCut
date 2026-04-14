import { Select } from "antd";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import ProShortcut from "@/components/ProShortcut";
import ProSwitch from "@/components/ProSwitch";
import { globalStore } from "@/stores/global";

const Screenshot = () => {
  const { screenshot, shortcut } = useSnapshot(globalStore);
  const { t } = useTranslation();

  return (
    <ProList header={t("preference.screenshot.settings.title")}>
      <ProShortcut
        description={t("preference.shortcut.shortcut.hints.screenshot")}
        onChange={(value) => {
          globalStore.shortcut.screenshot = value;
          if (globalStore.screenshot) {
            globalStore.screenshot.shortcut = value;
          }
        }}
        title={t("preference.shortcut.shortcut.label.screenshot")}
        value={shortcut.screenshot || ""}
      />

      <ProSwitch
        description={t("preference.screenshot.settings.hints.save_to_history")}
        onChange={(value) => {
          if (globalStore.screenshot) {
            globalStore.screenshot.saveToHistory = value;
          }
        }}
        title={t("preference.screenshot.settings.label.save_to_history")}
        value={screenshot?.saveToHistory ?? true}
      />

      <ProListItem
        description={t("preference.screenshot.settings.hints.default_action")}
        title={t("preference.screenshot.settings.label.default_action")}
      >
        <Select
          onChange={(value) => {
            if (globalStore.screenshot) {
              globalStore.screenshot.defaultAction = value;
            }
          }}
          options={[
            {
              label: t("preference.screenshot.settings.default_action.menu"),
              value: "menu",
            },
            {
              label: t("preference.screenshot.settings.default_action.copy"),
              value: "copy",
            },
            {
              label: t("preference.screenshot.settings.default_action.save"),
              value: "save",
            },
          ]}
          size="small"
          style={{ width: 120 }}
          value={screenshot?.defaultAction ?? "menu"}
        />
      </ProListItem>

      <ProListItem
        description={t("preference.screenshot.settings.hints.save_format")}
        title={t("preference.screenshot.settings.label.save_format")}
      >
        <Select
          onChange={(value) => {
            if (globalStore.screenshot) {
              globalStore.screenshot.saveFormat = value;
            }
          }}
          options={[
            { label: "PNG", value: "png" },
            { label: "JPG", value: "jpg" },
          ]}
          size="small"
          style={{ width: 80 }}
          value={screenshot?.saveFormat ?? "png"}
        />
      </ProListItem>
    </ProList>
  );
};

export default Screenshot;
