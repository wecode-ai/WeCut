import { exists } from "@tauri-apps/plugin-fs";
import {
  writeFiles,
  writeHTML,
  writeImage,
  writeRTF,
  writeText,
} from "tauri-plugin-clipboard-x-api";
import { clipboardStore } from "@/stores/clipboard";
import type { DatabaseSchemaHistory } from "@/types/database";
import { isColor, isEmail, isURL } from "@/utils/is";
import { paste } from "./paste";

export const getClipboardTextSubtype = async (value: string) => {
  try {
    if (isURL(value)) {
      return "url";
    }

    if (isEmail(value)) {
      return "email";
    }

    if (isColor(value)) {
      return "color";
    }

    if (await exists(value)) {
      return "path";
    }
  } catch {
    return;
  }
};

export const writeToClipboard = (data: DatabaseSchemaHistory) => {
  const { type, value, search } = data;

  switch (type) {
    case "text":
      return writeText(value);
    case "rtf":
      return writeRTF(search, value);
    case "html":
      return writeHTML(search, value);
    case "image":
      return writeImage(value);
    case "files":
      return writeFiles(value);
  }
};

export interface PasteResult {
  success: boolean;
  error?: "ACCESSIBILITY_DENIED" | "UNKNOWN";
  errorMessage?: string;
}

export const pasteToClipboard = async (
  data: DatabaseSchemaHistory,
  asPlain?: boolean,
): Promise<PasteResult> => {
  const { type, value, search } = data;
  const { pastePlain } = clipboardStore.content;

  if (asPlain ?? pastePlain) {
    if (type === "files") {
      await writeText(value.join("\n"));
    } else {
      await writeText(search);
    }
  } else {
    await writeToClipboard(data);
  }

  try {
    await paste();
    return { success: true };
  } catch (error) {
    const errorStr = String(error);
    if (errorStr.includes("ACCESSIBILITY_DENIED")) {
      return { error: "ACCESSIBILITY_DENIED", success: false };
    }
    return { error: "UNKNOWN", errorMessage: errorStr, success: false };
  }
};

export const runActivateAction = async (
  data: DatabaseSchemaHistory,
): Promise<PasteResult> => {
  const { activateAction } = clipboardStore.content;

  if (activateAction === "copy") {
    await writeToClipboard(data);
    return { success: true };
  }

  return pasteToClipboard(data);
};
