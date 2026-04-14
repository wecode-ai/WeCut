import { getTauriVersion } from "@tauri-apps/api/app";
import { appLogDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { arch, version } from "@tauri-apps/plugin-os";
import { Avatar, Button, message } from "antd";
import { useTranslation } from "react-i18next";
import { writeText } from "tauri-plugin-clipboard-x-api";
import { useSnapshot } from "valtio";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import { globalStore } from "@/stores/global";

const About = () => {
  const { env } = useSnapshot(globalStore);
  const { t } = useTranslation();

  const copyInfo = async () => {
    const { appName, appVersion, platform } = env;

    const info = {
      appName,
      appVersion,
      platform,
      platformArch: arch(),
      platformVersion: version(),
      tauriVersion: await getTauriVersion(),
    };

    await writeText(JSON.stringify(info, null, 2));

    message.success(t("preference.about.about_software.hints.copy_success"));
  };

  const openLogDir = async () => {
    try {
      const logDir = await appLogDir();
      await openPath(logDir);
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <ProList header={t("preference.about.about_software.title")}>
      <ProListItem
        avatar={<Avatar shape="square" size={44} src="/logo.png" />}
        description={`${t("preference.about.about_software.label.version")}v${env.appVersion}`}
        title={env.appName}
      >
        {/* 暂时隐藏检查更新按钮 */}
        {/* <Button
          onClick={() => {
            emit(LISTEN_KEY.UPDATE_APP, true);
          }}
          type="primary"
        >
          {t("preference.about.about_software.button.check_update")}
        </Button> */}
      </ProListItem>

      <ProListItem
        description={t("preference.about.about_software.hints.software_info")}
        title={t("preference.about.about_software.label.software_info")}
      >
        <Button onClick={copyInfo}>
          {t("preference.about.about_software.button.copy")}
        </Button>
      </ProListItem>

      <ProListItem
        description={t("preference.about.about_software.hints.open_log_dir")}
        title={t("preference.about.about_software.label.log_file")}
      >
        <Button onClick={openLogDir}>
          {t("preference.about.about_software.button.open_log_dir")}
        </Button>
      </ProListItem>
    </ProList>
  );
};

export default About;
