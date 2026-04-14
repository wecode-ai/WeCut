import Database from "@tauri-apps/plugin-sql";
import { isBoolean } from "es-toolkit";
import { Kysely, sql } from "kysely";
import { TauriSqliteDialect } from "kysely-dialect-tauri";
import { SerializePlugin } from "kysely-plugin-serialize";
import type { DatabaseSchema } from "@/types/database";
import { getSaveDatabasePath } from "@/utils/path";

let db: Kysely<DatabaseSchema> | null = null;

export const getDatabase = async () => {
  if (db) return db;

  const path = await getSaveDatabasePath();

  db = new Kysely<DatabaseSchema>({
    dialect: new TauriSqliteDialect({
      database: (prefix) => Database.load(prefix + path),
    }),
    plugins: [
      new SerializePlugin({
        deserializer: (value) => value,
        serializer: (value) => {
          if (isBoolean(value)) {
            return Number(value);
          }

          return value;
        },
      }),
    ],
  });

  // 创建主表
  await db.schema
    .createTable("history")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("type", "text")
    .addColumn("group", "text")
    .addColumn("value", "text")
    .addColumn("search", "text")
    .addColumn("count", "integer")
    .addColumn("width", "integer")
    .addColumn("height", "integer")
    .addColumn("favorite", "integer", (col) => col.defaultTo(0))
    .addColumn("createTime", "text")
    .addColumn("note", "text")
    .addColumn("subtype", "text")
    .execute();

  // 为已有数据库添加新字段（来源应用和文件元数据）
  const newColumns = [
    "sourceAppName",
    "sourceAppPath",
    "sourceAppBundleId",
    "sourceAppIcon",
    "fileMimeType",
    "title",
  ];

  for (const column of newColumns) {
    try {
      await sql`ALTER TABLE history ADD COLUMN ${sql.ref(column)} text`.execute(
        db,
      );
    } catch (_error) {}
  }

  try {
    await sql`ALTER TABLE history ADD COLUMN fileSize integer`.execute(db);
  } catch (_error) {}

  // 清理已有重复数据
  await deduplicateExistingData();

  // 创建唯一索引防止重复（type + value 组合必须唯一）
  try {
    await db.schema
      .createIndex("idx_history_type_value_unique")
      .on("history")
      .columns(["type", "value"])
      .unique()
      .ifNotExists()
      .execute();
  } catch (_error) {}

  // 创建普通索引优化查询
  try {
    await db.schema
      .createIndex("idx_history_createTime")
      .on("history")
      .column("createTime")
      .ifNotExists()
      .execute();
  } catch (_error) {}

  // 创建标签表
  await db.schema
    .createTable("tag")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("color", "text", (col) => col.notNull())
    .addColumn("createTime", "text")
    .execute();

  // 创建历史-标签关联表
  await db.schema
    .createTable("historyTag")
    .ifNotExists()
    .addColumn("historyId", "text", (col) =>
      col.references("history.id").onDelete("cascade"),
    )
    .addColumn("tagId", "text", (col) =>
      col.references("tag.id").onDelete("cascade"),
    )
    .execute();

  // 创建唯一索引防止重复关联
  try {
    await db.schema
      .createIndex("idx_history_tag_unique")
      .on("historyTag")
      .columns(["historyId", "tagId"])
      .unique()
      .ifNotExists()
      .execute();
  } catch (_error) {}

  // 创建标签索引优化查询
  try {
    await db.schema
      .createIndex("idx_history_tag_tagId")
      .on("historyTag")
      .column("tagId")
      .ifNotExists()
      .execute();
  } catch (_error) {}

  // 创建 text_expansion 表
  await db.schema
    .createTable("textExpansion")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("triggerWord", "text", (col) => col.notNull().unique())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("variables", "text")
    .addColumn("sourceHistoryId", "text")
    .addColumn("createTime", "text", (col) => col.notNull())
    .addColumn("updateTime", "text", (col) => col.notNull())
    .execute();

  return db;
};

/**
 * 清理数据库中已有的重复数据
 * 保留最新的记录，删除其他重复项
 */
const deduplicateExistingData = async () => {
  try {
    const db = await getDatabase();

    // 查找重复的 (type, value) 组合
    const duplicates = await sql`
      SELECT type, value, COUNT(*) as count
      FROM history
      GROUP BY type, value
      HAVING COUNT(*) > 1
    `.execute(db);

    if (!duplicates || duplicates.rows.length === 0) {
      return;
    }

    // 对于每组重复，保留最新的一条，删除其他
    for (const row of duplicates.rows) {
      const { type, value } = row as { type: string; value: string };

      // 获取该组合的所有记录，按时间倒序
      const records = await db
        .selectFrom("history")
        .selectAll()
        .where("type", "=", type)
        .where("value", "=", value)
        .orderBy("createTime", "desc")
        .execute();

      if (records.length <= 1) continue;

      // 保留第一条（最新的），删除其他
      const [_keep, ...toDelete] = records;

      for (const record of toDelete) {
        await db.deleteFrom("history").where("id", "=", record.id).execute();
      }
    }
  } catch (_error) {
    // 不要阻止应用启动，只是记录错误
  }
};

export const destroyDatabase = async () => {
  const db = await getDatabase();

  return db.destroy();
};
