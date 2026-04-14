import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { isString } from "es-toolkit/compat";
import { t } from "i18next";
import type { clipboardStore } from "@/stores/clipboard";
import type { DatabaseSchemaHistory } from "@/types/database";
import { DEFAULTS } from "@/utils/envConfig";
import { isImage } from "@/utils/is";

// 读取图片文件并转为 base64
export const readImageAsBase64 = async (path: string): Promise<string> => {
  const uint8Array = await readFile(path);
  const blob = new Blob([uint8Array]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// 构建文本类型的 content
export const buildTextContent = (
  value: string | string[],
  extraMessage?: string,
): string => {
  const textValue = isString(value) ? value : JSON.stringify(value);
  let content = `<paste_content>\n${textValue}\n</paste_content>`;

  if (extraMessage) {
    content += `\n\n<extra>\n${extraMessage}\n</extra>`;
  }

  return content;
};

// 构建图片类型的 content (OpenAI Responses API 格式)
export const buildImageContent = async (
  imagePath: string,
  extraMessage?: string,
): Promise<
  Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  >
> => {
  const base64Image = await readImageAsBase64(imagePath);
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  > = [
    {
      image_url: base64Image,
      type: "input_image",
    },
  ];

  if (extraMessage) {
    content.unshift({
      text: extraMessage,
      type: "input_text",
    });
  } else {
    content.unshift({
      text: "请分析这张图片",
      type: "input_text",
    });
  }

  return content;
};

// 发送消息到 Work Queue（通过 Rust 后端，绕过 CORS 和代理问题）
export const sendToWorkQueue = async (
  config: typeof clipboardStore.workQueueConfig,
  payload: {
    content?: string;
    files?: string[];
    title?: string;
    note?: string;
  },
) => {
  if (!config) {
    throw new Error(t("component.send_modal.error.config_missing"));
  }

  // 调用 Rust 命令发送请求
  // 注意：将空字符串转为 null，因为 API 不需要空字段
  const noteValue = payload.note?.trim() || null;
  const titleValue = payload.title?.trim() || null;

  await invoke("send_to_work_queue", {
    apiToken: config.apiToken,
    baseUrl: config.baseUrl,
    content: payload.content ?? null,
    filePaths: payload.files ?? [],
    note: noteValue,
    queueName: config.queueName,
    title: titleValue,
  });
};

// 发送消息到 AI Chat (OpenAI)
export const sendToAiChat = async (
  config: typeof clipboardStore.aiChatConfig,
  messageContent:
    | string
    | Array<
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string }
      >,
) => {
  if (!config) throw new Error(t("component.send_modal.error.config_missing"));

  const response = await fetch(`${config.baseUrl}/v1/responses`, {
    body: JSON.stringify({
      input: [
        {
          content: messageContent,
          role: "user",
        },
      ],
      model: config.model || DEFAULTS.AI_MODEL,
    }),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...config.customHeaders,
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }
};

// 处理 AI Chat 发送
export const handleAiChatSend = async (
  item: DatabaseSchemaHistory,
  aiChatConfig: typeof clipboardStore.aiChatConfig,
  extraMessage?: string,
) => {
  if (!aiChatConfig) {
    throw new Error(t("component.send_modal.error.config_missing"));
  }

  // 文件类型检查
  if (item.type === "files") {
    const files = Array.isArray(item.value) ? item.value : [item.value];
    if (files.length === 1 && isImage(files[0])) {
      // 继续执行
    } else {
      throw new Error(t("component.send_modal.error.unsupported_type"));
    }
  }

  let messageContent:
    | string
    | Array<
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string }
      >;

  if (item.type === "image") {
    const imagePath = isString(item.value) ? item.value : "";
    if (!imagePath) {
      throw new Error("图片路径无效");
    }
    messageContent = await buildImageContent(imagePath, extraMessage);
  } else if (item.type === "files") {
    const files = Array.isArray(item.value) ? item.value : [item.value];
    if (files.length === 1 && isString(files[0]) && isImage(files[0])) {
      messageContent = await buildImageContent(files[0], extraMessage);
    } else {
      throw new Error("暂不支持发送多个文件或非图片文件");
    }
  } else {
    messageContent = buildTextContent(item.value, extraMessage);
  }

  await sendToAiChat(aiChatConfig, messageContent);
};

// 处理 Work Queue 发送
export const handleWorkQueueSend = async (
  config: typeof clipboardStore.workQueueConfig,
  payload: {
    content?: string;
    files?: string[];
    title?: string;
    note?: string;
  },
) => {
  if (!config) {
    throw new Error(t("component.send_modal.error.config_missing"));
  }

  await sendToWorkQueue(config, {
    content: payload.content,
    files: payload.files,
    note: payload.note,
    title: payload.title,
  });
};
