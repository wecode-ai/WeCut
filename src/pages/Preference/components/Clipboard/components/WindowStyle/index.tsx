import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProSelect from "@/components/ProSelect";
import { clipboardStore } from "@/stores/clipboard";
import type { ClipboardStore } from "@/types/store";

interface Option {
  label: string;
  value: ClipboardStore["window"]["style"];
}

const WindowStyle = () => {
  const { window } = useSnapshot(clipboardStore);
  const { t } = useTranslation();

  const options: Option[] = [
    {
      label: t(
        "preference.clipboard.window_settings.label.window_style_standard",
      ),
      value: "standard",
    },
    {
      label: t("preference.clipboard.window_settings.label.window_style_dock"),
      value: "dock",
    },
  ];

  return (
    <ProSelect
      onChange={(value) => {
        clipboardStore.window.style = value;
      }}
      options={options}
      title={t("preference.clipboard.window_settings.label.window_style")}
      value={window.style}
    />
  );
};

export default WindowStyle;
