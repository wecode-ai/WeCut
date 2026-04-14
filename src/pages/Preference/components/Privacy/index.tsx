import { openUrl } from "@tauri-apps/plugin-opener";
import { Button, message } from "antd";
import { useTranslation } from "react-i18next";
import { writeText } from "tauri-plugin-clipboard-x-api";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";

const SOURCE_CODE_URL = "https://github.com/Micro66/weCut/";

const Privacy = () => {
  const { t } = useTranslation();

  const copyLink = async () => {
    await writeText(SOURCE_CODE_URL);
    message.success(t("preference.about.about_software.hints.copy_success"));
  };

  const openLink = async () => {
    await openUrl(SOURCE_CODE_URL);
  };

  return (
    <>
      <ProList header={t("preference.privacy.privacy_consideration.title")}>
        <ProListItem
          description={t(
            "preference.privacy.privacy_consideration.description",
          )}
          title={t("preference.privacy.privacy_consideration.label")}
        />
      </ProList>

      <ProList header={t("preference.privacy.data_collection.title")}>
        <ProListItem
          description={t("preference.privacy.data_collection.description")}
          title={t("preference.privacy.data_collection.label")}
        />
      </ProList>

      <ProList header={t("preference.privacy.open_source.title")}>
        <ProListItem
          description={
            <div className="flex flex-col gap-2">
              <span className="text-color-3 text-sm">{SOURCE_CODE_URL}</span>
              <div className="flex gap-2">
                <Button onClick={copyLink}>
                  {t("preference.about.about_software.button.copy")}
                </Button>
                <Button onClick={openLink} type="primary">
                  {t("preference.privacy.open_source.button.visit")}
                </Button>
              </div>
            </div>
          }
          title={t("preference.privacy.open_source.label")}
        />
      </ProList>
    </>
  );
};

export default Privacy;
