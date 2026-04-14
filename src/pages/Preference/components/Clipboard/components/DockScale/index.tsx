import { Segmented } from "antd";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import ProListItem from "@/components/ProListItem";
import { clipboardStore } from "@/stores/clipboard";

const DockScale = () => {
  const { window } = useSnapshot(clipboardStore);
  const { t } = useTranslation();

  // 只在 dock 模式下显示
  if (window.style !== "dock") {
    return null;
  }

  const options = [
    {
      label: t("preference.clipboard.window_settings.label.dock_scale_normal"),
      value: 0.9,
    },
    {
      label: t("preference.clipboard.window_settings.label.dock_scale_large"),
      value: 1,
    },
  ];

  return (
    <ProListItem
      description={t("preference.clipboard.window_settings.hints.dock_scale")}
      title={t("preference.clipboard.window_settings.label.dock_scale")}
    >
      <Segmented
        onChange={(value) => {
          clipboardStore.window.dockScale = value as number;
        }}
        options={options}
        value={window.dockScale}
      />
    </ProListItem>
  );
};

export default DockScale;
