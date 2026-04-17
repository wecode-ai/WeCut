import { emit } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useInterval } from "ahooks";
import { Button, Card, Flex, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const [accessibilityGranted, setAccessibilityGranted] = useState(false);
  const [screenRecordingGranted, setScreenRecordingGranted] = useState(false);
  const [fullDiskAccessGranted, setFullDiskAccessGranted] = useState(false);

  const allGranted =
    accessibilityGranted && screenRecordingGranted && fullDiskAccessGranted;

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

  const handleRequestAccessibility = async () => {
    await requestAccessibilityPermission();
  };

  const handleRequestScreenRecording = async () => {
    await requestScreenRecordingPermission();
  };

  const handleRequestFullDiskAccess = async () => {
    await requestFullDiskAccessPermission();
  };

  const handleComplete = async () => {
    globalStore.app.hasCompletedOnboarding = true;
    await saveStore();
    navigate("/");
  };

  const handleOpenPreference = async () => {
    globalStore.app.hasCompletedOnboarding = true;
    await saveStore();
    navigate("/");
    // 通知偏好设置窗口切换到 Wegent 集成 tab
    await showWindow(WINDOW_LABEL.PREFERENCE as any);
    await emit(LISTEN_KEY.PREFERENCE_NAVIGATE, "wegent");
  };

  const renderPermissionStatus = (
    granted: boolean,
    onRequest: () => void,
  ) => {
    if (granted) {
      return (
        <Flex align="center" gap={6} className="text-green-500 font-bold">
          <UnoIcon name="i-lucide:circle-check" />
          <span>{t("onboarding.permission.authorized")}</span>
        </Flex>
      );
    }

    return (
      <Button
        icon={<UnoIcon name="i-lucide:circle-arrow-right" />}
        onClick={onRequest}
        size="small"
        type="default"
        className="border-orange-400! text-orange-500!"
      >
        {t("onboarding.permission.authorize")}
      </Button>
    );
  };

  const permissions = [
    {
      key: "accessibility",
      title: t("onboarding.permission.accessibility.title"),
      description: t("onboarding.permission.accessibility.description"),
      granted: accessibilityGranted,
      onRequest: handleRequestAccessibility,
    },
    {
      key: "screenRecording",
      title: t("onboarding.permission.screen_recording.title"),
      description: t("onboarding.permission.screen_recording.description"),
      granted: screenRecordingGranted,
      onRequest: handleRequestScreenRecording,
    },
    {
      key: "fullDiskAccess",
      title: t("onboarding.permission.full_disk_access.title"),
      description: t("onboarding.permission.full_disk_access.description"),
      granted: fullDiskAccessGranted,
      onRequest: handleRequestFullDiskAccess,
    },
  ];

  return (
    <Flex
      className="min-h-screen bg-color-2 pb-24"
      justify="center"
      data-tauri-drag-region
    >
      <Flex
        className="w-full max-w-2xl px-8 pt-12"
        gap={32}
        vertical
      >
        {/* 区块 1：开源与隐私声明 */}
        <Flex align="center" gap={16} vertical className="text-center">
          <img
            alt="WeCut"
            className="h-16 w-16 rounded-2xl shadow-md"
            src="/logo.png"
          />
          <div>
            <Title level={2} className="mb-1!">
              WeCut
            </Title>
            <Paragraph className="text-color-3 text-base mx-auto max-w-md">
              {t("onboarding.privacy.description")}
            </Paragraph>
          </div>
          <a href={GITHUB_URL}>
            <Button icon={<UnoIcon name="i-lucide:github" />} type="default">
              {t("onboarding.privacy.view_source")}
            </Button>
          </a>
        </Flex>

        {/* 区块 2：macOS 权限引导 */}
        <div>
          <Title level={4} className="mb-4!">
            {t("onboarding.permissions.title")}
          </Title>
          <Paragraph className="text-color-3 mb-4!">
            {t("onboarding.permissions.description")}
          </Paragraph>
          <Flex gap={12} vertical>
            {permissions.map(({ key, title, description, granted, onRequest }) => (
              <Card
                key={key}
                size="small"
                className={
                  granted
                    ? "border-green-400!"
                    : "border-orange-400!"
                }
              >
                <Flex align="center" justify="space-between">
                  <Flex align="flex-start" gap={10} vertical={false}>
                    <UnoIcon
                      name={
                        granted
                          ? "i-lucide:shield-check"
                          : "i-lucide:shield-alert"
                      }
                      size={20}
                      className={granted ? "text-green-500 mt-0.5" : "text-orange-500 mt-0.5"}
                    />
                    <div>
                      <Text strong>{title}</Text>
                      <br />
                      <Text className="text-color-3 text-xs">{description}</Text>
                    </div>
                  </Flex>
                  {renderPermissionStatus(granted, onRequest)}
                </Flex>
              </Card>
            ))}
          </Flex>
        </div>

        {/* 区块 3：Wegent Key 配置（可选） */}
        <Card className="border-dashed!">
          <Flex align="flex-start" gap={12} vertical={false}>
            <UnoIcon
              name="i-lucide:key"
              size={20}
              className="text-color-3 mt-0.5 shrink-0"
            />
            <div className="flex-1">
              <Text strong>{t("onboarding.wegent.title")}</Text>
              <Paragraph className="text-color-3 text-xs mt-1! mb-3!">
                {t("onboarding.wegent.description")}
              </Paragraph>
              <Button
                icon={<UnoIcon name="i-lucide:settings" />}
                onClick={handleOpenPreference}
                size="small"
              >
                {t("onboarding.wegent.goto_preference")}
              </Button>
            </div>
          </Flex>
        </Card>
      </Flex>

      {/* 底部固定操作区 */}
      <div className="fixed bottom-0 left-0 right-0 bg-color-2 border-t border-color-4 py-4 px-8">
        <Flex align="center" justify="center" gap={12}>
          {!allGranted && (
            <Text className="text-color-3 text-sm">
              {t("onboarding.complete.hint")}
            </Text>
          )}
          <Tooltip
            title={!allGranted ? t("onboarding.complete.hint") : undefined}
          >
            <Button
              disabled={!allGranted}
              onClick={handleComplete}
              size="large"
              type="primary"
            >
              {t("onboarding.complete.button")}
            </Button>
          </Tooltip>
        </Flex>
      </div>
    </Flex>
  );
};

export default Onboarding;
