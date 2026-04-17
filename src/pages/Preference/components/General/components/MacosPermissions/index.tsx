import { confirm } from "@tauri-apps/plugin-dialog";
import { useMount, useReactive } from "ahooks";
import { useTranslation } from "react-i18next";
import {
  checkAccessibilityPermission,
  checkFullDiskAccessPermission,
  checkScreenRecordingPermission,
  requestAccessibilityPermission,
  requestFullDiskAccessPermission,
  requestScreenRecordingPermission,
} from "tauri-plugin-macos-permissions-api";
import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import UnoIcon from "@/components/UnoIcon";

const MacosPermissions = () => {
  const { t } = useTranslation();

  const state = useReactive({
    accessibilityPermission: false,
    fullDiskAccessPermission: false,
    screenRecordingPermission: false,
  });

  useMount(() => {
    // 只检查权限状态，不自动请求
    refreshPermissions();
  });

  // 刷新权限状态（只检查，不请求）
  const refreshPermissions = async () => {
    state.accessibilityPermission = await checkAccessibilityPermission();
    state.fullDiskAccessPermission = await checkFullDiskAccessPermission();
    state.screenRecordingPermission = await checkScreenRecordingPermission();
  };

  // 请求辅助功能权限（用户主动点击授权）
  const handleRequestAccessibility = async () => {
    await requestAccessibilityPermission();

    // 轮询检查权限是否已授予
    const check = async () => {
      state.accessibilityPermission = await checkAccessibilityPermission();

      if (state.accessibilityPermission) return;

      setTimeout(check, 1000);
    };

    check();
  };

  // 请求完全磁盘访问权限（用户主动点击授权）
  const handleRequestFullDiskAccess = async () => {
    const confirmed = await confirm(
      t(
        "preference.settings.permission_settings.hints.confirm_full_disk_access",
      ),
      {
        cancelLabel: t(
          "preference.settings.permission_settings.button.cancel_full_disk_access",
        ),
        okLabel: t(
          "preference.settings.permission_settings.button.confirm_full_disk_access",
        ),
        title: t(
          "preference.settings.permission_settings.label.confirm_full_disk_access",
        ),
      },
    );

    if (!confirmed) return;

    requestFullDiskAccessPermission();

    // 轮询检查权限是否已授予
    const check = async () => {
      state.fullDiskAccessPermission = await checkFullDiskAccessPermission();

      if (state.fullDiskAccessPermission) return;

      setTimeout(check, 1000);
    };

    check();
  };

  // 请求屏幕录制权限（用户主动点击授权）
  const handleRequestScreenRecording = async () => {
    await requestScreenRecordingPermission();

    // 轮询检查权限是否已授予
    const check = async () => {
      state.screenRecordingPermission = await checkScreenRecordingPermission();

      if (state.screenRecordingPermission) return;

      setTimeout(check, 1000);
    };

    check();
  };

  const renderStatus = (
    authorized: boolean,
    onAuthorize: () => Promise<void>,
  ) => {
    return (
      <div className="children:(inline-flex items-center gap-1 font-bold)">
        {authorized ? (
          <div className="text-primary">
            <UnoIcon name="i-lucide:circle-check" />
            {t("preference.settings.permission_settings.label.authorized")}
          </div>
        ) : (
          <div
            className="cursor-pointer text-danger"
            onMouseDown={onAuthorize}
            title={t(
              "preference.settings.permission_settings.button.authorize",
            )}
          >
            <UnoIcon name="i-lucide:circle-arrow-right" />
            {t("preference.settings.permission_settings.button.authorize")}
          </div>
        )}
      </div>
    );
  };

  return (
    <ProList header={t("preference.settings.permission_settings.title")}>
      <ProListItem
        description={t(
          "preference.settings.permission_settings.hints.accessibility_permissions",
        )}
        title={t(
          "preference.settings.permission_settings.label.accessibility_permissions",
        )}
      >
        {renderStatus(
          state.accessibilityPermission,
          handleRequestAccessibility,
        )}
      </ProListItem>

      <ProListItem
        description={t(
          "preference.settings.permission_settings.hints.full_disk_access_permissions",
        )}
        title={t(
          "preference.settings.permission_settings.label.full_disk_access_permissions",
        )}
      >
        {renderStatus(
          state.fullDiskAccessPermission,
          handleRequestFullDiskAccess,
        )}
      </ProListItem>

      <ProListItem
        description={t(
          "preference.settings.permission_settings.hints.screen_recording_permissions",
          "截图功能需要屏幕录制权限才能正常工作",
        )}
        title={t(
          "preference.settings.permission_settings.label.screen_recording_permissions",
          "屏幕录制权限",
        )}
      >
        {renderStatus(
          state.screenRecordingPermission,
          handleRequestScreenRecording,
        )}
      </ProListItem>
    </ProList>
  );
};

export default MacosPermissions;
