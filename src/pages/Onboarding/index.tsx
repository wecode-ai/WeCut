import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useInterval } from "ahooks";
import { Button, Card, Flex, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  checkAccessibilityPermission,
  checkFullDiskAccessPermission,
  checkScreenRecordingPermission,
  requestAccessibilityPermission,
  requestFullDiskAccessPermission,
  requestScreenRecordingPermission,
} from "tauri-plugin-macos-permissions-api";
import UnoIcon from "@/components/UnoIcon";
import { LISTEN_KEY, WINDOW_LABEL } from "@/constants";
import { showWindow } from "@/plugins/window";
import { globalStore } from "@/stores/global";
import { saveStore } from "@/utils/store";

const { Title, Text, Paragraph } = Typography;

const GITHUB_URL = "https://github.com/wecode-ai/WeCut";

const Onboarding = () => {
  const { t } = useTranslation();

  const [accessibilityGranted, setAccessibilityGranted] = useState(false);
  const [screenRecordingGranted, setScreenRecordingGranted] = useState(false);
  const [fullDiskAccessGranted, setFullDiskAccessGranted] = useState(false);

  // 必要授权：屏幕录制和辅助功能
  const requiredGranted = screenRecordingGranted && accessibilityGranted;

  // 初始检测权限状态
  useEffect(() => {
    checkAllPermissions();
  }, []);

  // 每秒轮询权限状态（用户从系统设置返回后立即刷新）
  useInterval(() => {
    checkAllPermissions();
  }, 1000);

  const checkAllPermissions = async () => {
    const [accessibility, screenRecording, fullDisk] = await Promise.all([
      checkAccessibilityPermission(),
      checkScreenRecordingPermission(),
      checkFullDiskAccessPermission(),
    ]);
    setAccessibilityGranted(accessibility);
    setScreenRecordingGranted(screenRecording);
    setFullDiskAccessGranted(fullDisk);
  };

  // 请求辅助功能权限
  const handleRequestAccessibility = async () => {
    await requestAccessibilityPermission();
    // 立即检查一次，然后开始轮询
    const granted = await checkAccessibilityPermission();
    setAccessibilityGranted(granted);
  };

  // 请求屏幕录制权限
  const handleRequestScreenRecording = async () => {
    await requestScreenRecordingPermission();
    // 立即检查一次，然后开始轮询
    const granted = await checkScreenRecordingPermission();
    setScreenRecordingGranted(granted);
  };

  // 请求完全磁盘访问权限（需要确认对话框）
  const handleRequestFullDiskAccess = async () => {
    const confirmed = await confirm(
      t("onboarding.permission.full_disk_access.confirm_message"),
      {
        cancelLabel: t("onboarding.permission.full_disk_access.cancel"),
        okLabel: t("onboarding.permission.full_disk_access.confirm"),
        title: t("onboarding.permission.full_disk_access.confirm_title"),
      },
    );

    if (!confirmed) return;

    await requestFullDiskAccessPermission();
    // 立即检查一次
    const granted = await checkFullDiskAccessPermission();
    setFullDiskAccessGranted(granted);
  };

  const handleComplete = async () => {
    globalStore.app.hasCompletedOnboarding = true;
    await saveStore();
    // 关闭引导窗口，显示主窗口
    const window = getCurrentWebviewWindow();
    await window.close();
    showWindow(WINDOW_LABEL.MAIN);
  };

  const handleOpenPreference = async () => {
    // 显示偏好设置窗口，不关闭 Onboarding（保留在后台）
    await showWindow(WINDOW_LABEL.PREFERENCE as any);
    // 通知偏好设置窗口切换到 Wegent 集成 tab
    await emit(LISTEN_KEY.PREFERENCE_NAVIGATE, "wegent");
  };

  const renderPermissionStatus = (granted: boolean, onRequest: () => void) => {
    if (granted) {
      return (
        <Flex
          align="center"
          className="shrink-0 font-bold text-green-500"
          gap={6}
        >
          <UnoIcon name="i-lucide:circle-check" />
          <span>{t("onboarding.permission.authorized")}</span>
        </Flex>
      );
    }

    return (
      <Button
        className="shrink-0 border-orange-400! text-orange-500!"
        icon={<UnoIcon name="i-lucide:circle-arrow-right" />}
        onClick={onRequest}
        size="small"
        type="default"
      >
        {t("onboarding.permission.authorize")}
      </Button>
    );
  };

  // 必要授权：屏幕录制和辅助功能
  const requiredPermissions = [
    {
      description: t("onboarding.permission.screen_recording.description"),
      granted: screenRecordingGranted,
      key: "screenRecording",
      onRequest: handleRequestScreenRecording,
      title: t("onboarding.permission.screen_recording.title"),
    },
    {
      description: t("onboarding.permission.accessibility.description"),
      granted: accessibilityGranted,
      key: "accessibility",
      onRequest: handleRequestAccessibility,
      title: t("onboarding.permission.accessibility.title"),
    },
  ];

  // 选择授权：完全磁盘访问、Wegent 集成
  const optionalPermissions = [
    {
      description: t("onboarding.wegent.description"),
      key: "wegent",
      onRequest: handleOpenPreference,
      title: t("onboarding.wegent.title"),
      type: "wegent" as const,
    },
    {
      description: t("onboarding.permission.full_disk_access.description"),
      granted: fullDiskAccessGranted,
      key: "fullDiskAccess",
      onRequest: handleRequestFullDiskAccess,
      title: t("onboarding.permission.full_disk_access.title"),
    },
  ];

  return (
    <div className="flex h-full flex-col bg-color-2" data-tauri-drag-region>
      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {/* 区块 1：开源与隐私声明 */}
          <Flex align="center" className="text-center" gap={12} vertical>
            <img
              alt="WeCut"
              className="h-14 w-14 rounded-xl shadow-md"
              src="/logo.png"
            />
            <div>
              <Title className="mt-0! mb-1!" level={3}>
                WeCut
              </Title>
              <Paragraph className="mx-auto mb-2! max-w-md text-color-3 text-sm">
                {t("onboarding.privacy.description")}
              </Paragraph>
            </div>
            <a href={GITHUB_URL}>
              <Button
                icon={<UnoIcon name="i-lucide:github" />}
                size="small"
                type="default"
              >
                {t("onboarding.privacy.view_source")}
              </Button>
            </a>
          </Flex>

          {/* 区块 2：必要授权 */}
          <div>
            <Title className="mt-0! mb-3!" level={5}>
              {t("onboarding.required_permissions.title")}
            </Title>
            <Flex gap={10} vertical>
              {requiredPermissions.map(
                ({ key, title, description, granted, onRequest }) => (
                  <Card
                    className={
                      granted ? "border-green-400!" : "border-orange-400!"
                    }
                    key={key}
                    size="small"
                    styles={{ body: { padding: "12px 16px" } }}
                  >
                    <Flex align="center" gap={12} justify="space-between">
                      <Flex align="flex-start" gap={10}>
                        <UnoIcon
                          className={
                            granted
                              ? "mt-0.5 shrink-0 text-green-500"
                              : "mt-0.5 shrink-0 text-orange-500"
                          }
                          name={
                            key === "accessibility"
                              ? granted
                                ? "i-lucide:accessibility"
                                : "i-lucide:accessibility"
                              : granted
                                ? "i-lucide:video-check"
                                : "i-lucide:video"
                          }
                          size={18}
                        />
                        <div className="min-w-0">
                          <Text className="text-sm" strong>
                            {title}
                          </Text>
                          <br />
                          <Text className="text-color-3 text-xs">
                            {description}
                          </Text>
                        </div>
                      </Flex>
                      {renderPermissionStatus(granted, onRequest)}
                    </Flex>
                  </Card>
                ),
              )}
            </Flex>
          </div>

          {/* 区块 3：选择授权 */}
          <div>
            <Title className="mt-0! mb-3!" level={5}>
              {t("onboarding.optional_permissions.title")}
            </Title>
            <Flex gap={10} vertical>
              {optionalPermissions.map((item) => (
                <Card
                  className={
                    item.type === "wegent"
                      ? "border-dashed!"
                      : item.granted
                        ? "border-green-400!"
                        : "border-color-3!"
                  }
                  key={item.key}
                  size="small"
                  styles={{ body: { padding: "12px 16px" } }}
                >
                  <Flex align="center" gap={12} justify="space-between">
                    <Flex align="flex-start" gap={10}>
                      <UnoIcon
                        className={
                          item.type === "wegent"
                            ? "mt-0.5 shrink-0 text-color-3"
                            : item.granted
                              ? "mt-0.5 shrink-0 text-green-500"
                              : "mt-0.5 shrink-0 text-color-3"
                        }
                        name={
                          item.type === "wegent"
                            ? "i-lucide:key"
                            : item.granted
                              ? "i-lucide:shield-check"
                              : "i-lucide:hard-drive"
                        }
                        size={18}
                      />
                      <div className="min-w-0">
                        <Text className="text-sm" strong>
                          {item.title}
                        </Text>
                        <br />
                        <Text className="text-color-3 text-xs">
                          {item.description}
                        </Text>
                      </div>
                    </Flex>
                    {item.type === "wegent" ? (
                      <Button
                        icon={<UnoIcon name="i-lucide:settings" />}
                        onClick={item.onRequest}
                        size="small"
                      >
                        {t("onboarding.wegent.goto_preference")}
                      </Button>
                    ) : (
                      renderPermissionStatus(item.granted!, item.onRequest)
                    )}
                  </Flex>
                </Card>
              ))}
            </Flex>
          </div>
        </div>
      </div>

      {/* 底部操作区 - 固定在底部 */}
      <div className="shrink-0 border-color-4 border-t bg-color-2 px-8 py-3">
        <Flex align="center" gap={12} justify="center">
          {
            <Text className="text-color-3 text-sm">
              {t("onboarding.complete.hint")}
            </Text>
          }
          <Button
            disabled={!requiredGranted}
            onClick={handleComplete}
            type="primary"
          >
            {t("onboarding.complete.button")}
          </Button>
        </Flex>
      </div>
    </div>
  );
};

export default Onboarding;
