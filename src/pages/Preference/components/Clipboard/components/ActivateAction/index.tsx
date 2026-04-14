import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProSelect from "@/components/ProSelect";
import { clipboardStore } from "@/stores/clipboard";
import type { ClipboardStore } from "@/types/store";

interface Option {
  label: string;
  value: ClipboardStore["content"]["activateAction"];
}

const ActivateAction = () => {
  const { content } = useSnapshot(clipboardStore);
  const { t } = useTranslation();

  const options: Option[] = [
    {
      label: t(
        "preference.clipboard.content_settings.label.activate_action_copy",
      ),
      value: "copy",
    },
    {
      label: t(
        "preference.clipboard.content_settings.label.activate_action_paste",
      ),
      value: "paste",
    },
  ];

  return (
    <ProSelect
      description={t(
        "preference.clipboard.content_settings.hints.activate_action",
      )}
      onChange={(value) => {
        clipboardStore.content.activateAction = value;
      }}
      options={options}
      title={t("preference.clipboard.content_settings.label.activate_action")}
      value={content.activateAction}
    />
  );
};

export default ActivateAction;
