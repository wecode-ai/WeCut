import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProList from "@/components/ProList";
import ProSwitch from "@/components/ProSwitch";
import { clipboardStore } from "@/stores/clipboard";
import ActivateAction from "./components/ActivateAction";
import AudioSettings from "./components/AudioSettings";
import AutoPaste from "./components/AutoPaste";
import DockScale from "./components/DockScale";
import OperationButton from "./components/OperationButton";
import SearchPosition from "./components/SearchPosition";
import WindowPosition from "./components/WindowPosition";
import WindowStyle from "./components/WindowStyle";

const ClipboardSettings = () => {
  const { window, search, content } = useSnapshot(clipboardStore);
  const { t } = useTranslation();

  return (
    <>
      <ProList header={t("preference.clipboard.window_settings.title")}>
        <WindowStyle />

        <DockScale />

        <WindowPosition />

        <ProSwitch
          description={t("preference.clipboard.window_settings.hints.back_top")}
          onChange={(value) => {
            clipboardStore.window.backTop = value;
          }}
          title={t("preference.clipboard.window_settings.label.back_top")}
          value={window.backTop}
        />

        <ProSwitch
          description={t(
            "preference.clipboard.window_settings.hints.remember_active_id",
          )}
          onChange={(value) => {
            clipboardStore.window.rememberActiveId = value;
          }}
          title={t(
            "preference.clipboard.window_settings.label.remember_active_id",
          )}
          value={window.rememberActiveId}
        />

        <ProSwitch
          onChange={(value) => {
            clipboardStore.window.showAll = value;
          }}
          title={t("preference.clipboard.window_settings.label.show_all")}
          value={window.showAll}
        />
      </ProList>

      <AudioSettings />

      <ProList
        header={t(
          "preference.clipboard.notification_settings.title",
          "通知设置",
        )}
      >
        <ProSwitch
          description={t(
            "preference.clipboard.notification_settings.hints.paste_success",
            "粘贴成功后显示提示",
          )}
          onChange={(value) => {
            clipboardStore.notification.pasteSuccess = value;
          }}
          title={t(
            "preference.clipboard.notification_settings.label.paste_success",
            "粘贴成功提示",
          )}
          value={clipboardStore.notification.pasteSuccess}
        />
      </ProList>

      <ProList header={t("preference.clipboard.search_box_settings.title")}>
        <SearchPosition key={1} />

        <ProSwitch
          description={t(
            "preference.clipboard.search_box_settings.hints.default_focus",
          )}
          onChange={(value) => {
            clipboardStore.search.defaultFocus = value;
          }}
          title={t(
            "preference.clipboard.search_box_settings.label.default_focus",
          )}
          value={search.defaultFocus}
        />

        <ProSwitch
          description={t(
            "preference.clipboard.search_box_settings.hints.auto_clear",
          )}
          onChange={(value) => {
            clipboardStore.search.autoClear = value;
          }}
          title={t("preference.clipboard.search_box_settings.label.auto_clear")}
          value={search.autoClear}
        />
      </ProList>

      <ProList header={t("preference.clipboard.content_settings.title")}>
        <AutoPaste />
        <ActivateAction />

        <ProSwitch
          description={t(
            "preference.clipboard.content_settings.hints.copy_as_plain",
          )}
          onChange={(value) => {
            clipboardStore.content.copyPlain = value;
          }}
          title={t("preference.clipboard.content_settings.label.copy_as_plain")}
          value={content.copyPlain}
        />

        <ProSwitch
          description={t(
            "preference.clipboard.content_settings.hints.paste_as_plain",
          )}
          onChange={(value) => {
            clipboardStore.content.pastePlain = value;
          }}
          title={t(
            "preference.clipboard.content_settings.label.paste_as_plain",
          )}
          value={content.pastePlain}
        />

        <OperationButton />

        <ProSwitch
          description={t(
            "preference.clipboard.content_settings.hints.auto_favorite",
          )}
          onChange={(value) => {
            clipboardStore.content.autoFavorite = value;
          }}
          title={t("preference.clipboard.content_settings.label.auto_favorite")}
          value={content.autoFavorite}
        />

        <ProSwitch
          description={t(
            "preference.clipboard.content_settings.hints.delete_confirm",
          )}
          onChange={(value) => {
            clipboardStore.content.deleteConfirm = value;
          }}
          title={t(
            "preference.clipboard.content_settings.label.delete_confirm",
          )}
          value={content.deleteConfirm}
        />

        <ProSwitch
          description={t(
            "preference.clipboard.content_settings.hints.auto_sort",
          )}
          onChange={(value) => {
            clipboardStore.content.autoSort = value;
          }}
          title={t("preference.clipboard.content_settings.label.auto_sort")}
          value={content.autoSort}
        />

        <ProSwitch
          description={t(
            "preference.clipboard.content_settings.hints.show_original_content",
          )}
          onChange={(value) => {
            clipboardStore.content.showOriginalContent = value;
          }}
          title={t(
            "preference.clipboard.content_settings.label.show_original_content",
          )}
          value={content.showOriginalContent}
        />
      </ProList>
    </>
  );
};

export default ClipboardSettings;
