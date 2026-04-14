import { useMount, useUnmount } from "ahooks";
import { isEmpty } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { useRef } from "react";
import {
  type ClipboardChangeOptions,
  onClipboardChange,
  startListening,
} from "tauri-plugin-clipboard-x-api";
import { fullName } from "tauri-plugin-fs-pro-api";
import {
  deleteHistory,
  selectHistory,
  upsertHistory,
} from "@/database/history";
import type { State } from "@/pages/Main";
import { getActiveApp, getAppIcon } from "@/plugins/active-app";
import { getClipboardTextSubtype } from "@/plugins/clipboard";
import { clipboardStore } from "@/stores/clipboard";
import type { DatabaseSchemaHistory } from "@/types/database";
import {
  generateContentHash,
  releaseLock,
  tryAcquireLock,
} from "@/utils/clipboardLock";
import { formatDate } from "@/utils/dayjs";
import { removeFromList, shouldShowInGroup } from "@/utils/dedup";

// 模块级变量，确保全局只有一个监听器状态
let isListeningStarted = false;
let listenerRegistered = false;

export const useClipboard = (
  state: State,
  options?: ClipboardChangeOptions,
) => {
  // 使用 ref 来存储清理函数
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useMount(async () => {
    // 防止重复启动监听
    if (isListeningStarted) {
      return;
    }

    isListeningStarted = true;

    await startListening();

    // 防止重复注册回调
    if (listenerRegistered) {
      return;
    }

    listenerRegistered = true;

    const unsubscribe = onClipboardChange(async (result) => {
      const { files, image, html, rtf, text } = result;

      if (isEmpty(result) || Object.values(result).every(isEmpty)) return;

      const { copyPlain } = clipboardStore.content;

      const data = {
        createTime: formatDate(),
        favorite: false,
        group: "text",
        id: nanoid(),
        search: text?.value,
      } as DatabaseSchemaHistory;

      // 优先级：files > image > html > rtf > text
      // macOS 复制任何文件都会同时放入缩略图（image）和文件路径（files）
      // files 存在时一定是用户复制了文件，应始终优先走 files 分支
      // 只有纯图片复制（截图、浏览器复制图片等）才没有 files，走 image 分支
      if (files) {
        Object.assign(data, files, {
          group: "files",
          search: files.value.join(" "),
        });
      } else if (image) {
        Object.assign(data, image, {
          group: "image",
        });
      } else if (html && !copyPlain) {
        Object.assign(data, html);
      } else if (rtf && !copyPlain) {
        Object.assign(data, rtf);
      } else if (text) {
        const subtype = await getClipboardTextSubtype(text.value);

        Object.assign(data, text, {
          subtype,
        });
      }

      const { type, value, group } = data;

      // 生成内容哈希用于去重锁
      const contentHash = generateContentHash(type, value);

      // 尝试获取处理锁
      if (!tryAcquireLock(contentHash)) {
        return;
      }

      try {
        // 准备数据库存储的值
        let sqlValue = value;

        if (type === "image") {
          sqlValue = await fullName(value);
        } else if (type === "files") {
          sqlValue = JSON.stringify(value);
        }

        const sqlData: DatabaseSchemaHistory = {
          ...data,
          value: sqlValue,
        };

        // 获取来源应用信息
        try {
          const appInfo = await getActiveApp();
          if (appInfo.name) {
            sqlData.sourceAppName = appInfo.name;
            sqlData.sourceAppPath = appInfo.path;
            sqlData.sourceAppBundleId = appInfo.bundle_id;

            // 异步获取应用图标
            if (appInfo.bundle_id) {
              const iconPath = await getAppIcon(
                appInfo.bundle_id,
                appInfo.path,
              );
              if (iconPath) {
                sqlData.sourceAppIcon = iconPath;
              }
            }
          }
        } catch (_error) {
          // 获取来源应用失败不阻断主流程
        }

        // 第一步：查询数据库中是否已存在（包括处理并发情况）
        const existingList = await selectHistory((qb) => {
          return qb
            .where("type", "=", sqlData.type)
            .where("value", "=", sqlData.value)
            .orderBy("createTime", "desc");
        });

        const visible = shouldShowInGroup(state.group, group);

        if (existingList.length > 0) {
          // 获取最新的记录
          const existing = existingList[0];

          // 从 UI 列表中移除旧记录（如果有）
          const existingInList = state.list.find(
            (item) => item.id === existing.id,
          );
          if (existingInList) {
            removeFromList(state.list, existing.id);
          }

          // 删除多余的重复记录（只保留第一条）
          for (let i = 1; i < existingList.length; i++) {
            await deleteHistory(existingList[i]);
            removeFromList(state.list, existingList[i].id);
          }

          // 更新记录（增加计数，更新时间）
          const result = await upsertHistory(sqlData);

          if (visible) {
            state.list.unshift({
              ...data,
              favorite: existing.favorite,
              id: result.id,
              sourceAppBundleId: sqlData.sourceAppBundleId,
              sourceAppIcon: sqlData.sourceAppIcon,
              sourceAppName: sqlData.sourceAppName,
              sourceAppPath: sqlData.sourceAppPath,
            });
          }
        } else {
          // 没有重复，直接插入
          const result = await upsertHistory(sqlData);

          if (visible) {
            state.list.unshift({
              ...data,
              id: result.id,
              sourceAppBundleId: sqlData.sourceAppBundleId,
              sourceAppIcon: sqlData.sourceAppIcon,
              sourceAppName: sqlData.sourceAppName,
              sourceAppPath: sqlData.sourceAppPath,
            });
          }
        }
      } finally {
        // 释放锁
        releaseLock(contentHash);
      }
    }, options);

    unsubscribeRef.current = unsubscribe;
  });

  // 组件卸载时清理
  useUnmount(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
  });
};
