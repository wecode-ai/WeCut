import { exists, remove } from "@tauri-apps/plugin-fs";
import type { AnyObject } from "antd/es/_util/type";
import type { SelectQueryBuilder } from "kysely";
import { getDefaultSaveImagePath } from "tauri-plugin-clipboard-x-api";
import type { DatabaseSchema, DatabaseSchemaHistory } from "@/types/database";
import { join } from "@/utils/path";
import { getDatabase } from ".";

type QueryBuilder = SelectQueryBuilder<DatabaseSchema, "history", AnyObject>;

export const selectHistory = async (
  fn?: (qb: QueryBuilder) => QueryBuilder,
) => {
  const db = await getDatabase();

  let qb = db.selectFrom("history").selectAll() as QueryBuilder;

  if (fn) {
    qb = fn(qb);
  }

  return qb.execute() as Promise<DatabaseSchemaHistory[]>;
};

export const insertHistory = async (data: DatabaseSchemaHistory) => {
  const db = await getDatabase();

  try {
    return await db.insertInto("history").values(data).execute();
  } catch (error: any) {
    // 处理唯一索引冲突（SQLite 错误码 2067 表示 UNIQUE constraint failed）
    if (
      error?.message?.includes("UNIQUE constraint failed") ||
      error?.message?.includes("2067") ||
      error?.message?.toLowerCase()?.includes("unique")
    ) {
      // 返回已有记录的 ID
      const existing = await db
        .selectFrom("history")
        .select("id")
        .where("type", "=", data.type)
        .where("value", "=", data.value)
        .executeTakeFirst();

      return { existingId: existing?.id, skipped: true };
    }

    // 其他错误继续抛出
    throw error;
  }
};

/**
 * 插入或更新历史记录
 * 如果记录已存在，则更新创建时间，增加计数
 * @returns 操作结果，包含执行的动作和记录ID
 */
export const upsertHistory = async (
  data: DatabaseSchemaHistory,
): Promise<{ action: "inserted" | "updated"; id: string }> => {
  const db = await getDatabase();

  // 先查询是否存在
  const existing = await db
    .selectFrom("history")
    .selectAll()
    .where("type", "=", data.type)
    .where("value", "=", data.value)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable("history")
      .set({
        count: (existing.count || 0) + 1,
        createTime: data.createTime,
        sourceAppBundleId: data.sourceAppBundleId,
        sourceAppIcon: data.sourceAppIcon,
        sourceAppName: data.sourceAppName,
        sourceAppPath: data.sourceAppPath,
      })
      .where("id", "=", existing.id)
      .execute();

    return { action: "updated", id: existing.id };
  }

  // 插入新记录
  try {
    await db.insertInto("history").values(data).execute();
    return { action: "inserted", id: data.id };
  } catch (error: any) {
    // 处理可能的并发插入冲突
    if (
      error?.message?.includes("UNIQUE constraint failed") ||
      error?.message?.toLowerCase()?.includes("unique")
    ) {
      const concurrent = await db
        .selectFrom("history")
        .selectAll()
        .where("type", "=", data.type)
        .where("value", "=", data.value)
        .executeTakeFirst();

      if (concurrent) {
        await db
          .updateTable("history")
          .set({
            count: (concurrent.count || 0) + 1,
            createTime: data.createTime,
            sourceAppBundleId: data.sourceAppBundleId,
            sourceAppIcon: data.sourceAppIcon,
            sourceAppName: data.sourceAppName,
            sourceAppPath: data.sourceAppPath,
          })
          .where("id", "=", concurrent.id)
          .execute();

        return { action: "updated", id: concurrent.id };
      }
    }

    throw error;
  }
};

export const updateHistory = async (
  id: string,
  nextData: Partial<DatabaseSchemaHistory>,
) => {
  // Filter out undefined values to avoid empty SET clause
  const filtered = Object.fromEntries(
    Object.entries(nextData).filter(([_, v]) => v !== undefined),
  ) as Partial<DatabaseSchemaHistory>;

  if (Object.keys(filtered).length === 0) return;

  const db = await getDatabase();

  return db.updateTable("history").set(filtered).where("id", "=", id).execute();
};

export const deleteHistory = async (data: DatabaseSchemaHistory) => {
  const { id, type, value } = data;

  const db = await getDatabase();

  await db.deleteFrom("history").where("id", "=", id).execute();

  if (type !== "image") return;

  let path = value;

  const saveImagePath = await getDefaultSaveImagePath();

  if (!value.startsWith(saveImagePath)) {
    path = join(saveImagePath, value);
  }

  const existed = await exists(path);

  if (!existed) return;

  return remove(path);
};
