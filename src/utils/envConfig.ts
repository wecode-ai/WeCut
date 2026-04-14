/**
 * 环境变量配置模块
 */

// 默认使用 WeCutPlat 作为平台名称
const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME || "WeCutPlat";

// AI 服务域名
const AI_DOMAIN = import.meta.env.VITE_AI_DOMAIN || "wecutplat.ai";

// AI 模型名称（替代 wegent-chat）
const AI_MODEL =
  import.meta.env.VITE_AI_MODEL ||
  `default#${PLATFORM_NAME.toLowerCase()}-chat`;

export const ENV_CONFIG = {
  AI_CHAT_URL: `https://${AI_DOMAIN}/api`,

  // AI 服务域名和 URL
  AI_DOMAIN,

  // AI 模型名称
  AI_MODEL,

  // API Key 页面 URL
  API_KEY_URL: `https://${AI_DOMAIN}/settings?section=api-keys&tab=api-keys`,

  // 功能开关环境变量名（替代 ECO_FEATURE_WEGENT_CHAT）
  FEATURE_FLAG_KEY: "ECO_FEATURE_AI_CHAT",
  // 平台名称
  PLATFORM_NAME,
  WORK_QUEUE_URL: `https://${AI_DOMAIN}`,
};

// 导出默认值供 store 初始化使用
export const DEFAULTS = {
  AI_CHAT_URL: ENV_CONFIG.AI_CHAT_URL,
  AI_MODEL: ENV_CONFIG.AI_MODEL,
  API_KEY_URL: ENV_CONFIG.API_KEY_URL,
  WORK_QUEUE_URL: ENV_CONFIG.WORK_QUEUE_URL,
};
