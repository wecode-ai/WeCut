import { nanoid } from "nanoid";
import type { DatabaseSchemaTag } from "@/types/database";
import { getDatabase } from ".";

// 标签 CRUD
export const createTag = async (
  data: Pick<DatabaseSchemaTag, "name" | "color">,
): Promise<DatabaseSchemaTag> => {
  const db = await getDatabase();

  const tag: DatabaseSchemaTag = {
    color: data.color,
    createTime: new Date().toISOString(),
    id: nanoid(),
    name: data.name,
  };

  await db.insertInto("tag").values(tag).execute();

  return tag;
};

export const updateTag = async (
  id: string,
  data: Partial<Pick<DatabaseSchemaTag, "name" | "color">>,
): Promise<void> => {
  const db = await getDatabase();

  await db.updateTable("tag").set(data).where("id", "=", id).execute();
};

export const deleteTag = async (id: string): Promise<void> => {
  const db = await getDatabase();

  // 先删除关联
  await db.deleteFrom("historyTag").where("tagId", "=", id).execute();

  // 再删除标签
  await db.deleteFrom("tag").where("id", "=", id).execute();
};

export const selectTags = async (): Promise<DatabaseSchemaTag[]> => {
  const db = await getDatabase();

  return db
    .selectFrom("tag")
    .selectAll()
    .orderBy("createTime", "asc")
    .execute();
};

// 关联操作
export const addTagToHistory = async (
  historyId: string,
  tagId: string,
): Promise<void> => {
  const db = await getDatabase();

  try {
    await db.insertInto("historyTag").values({ historyId, tagId }).execute();
  } catch (error: any) {
    // 忽略唯一约束冲突（已存在）
    if (!error?.message?.includes("UNIQUE")) {
      throw error;
    }
  }
};

export const removeTagFromHistory = async (
  historyId: string,
  tagId: string,
): Promise<void> => {
  const db = await getDatabase();

  await db
    .deleteFrom("historyTag")
    .where("historyId", "=", historyId)
    .where("tagId", "=", tagId)
    .execute();
};

export const getHistoryTags = async (
  historyId: string,
): Promise<DatabaseSchemaTag[]> => {
  const db = await getDatabase();

  return db
    .selectFrom("historyTag")
    .innerJoin("tag", "tag.id", "historyTag.tagId")
    .where("historyTag.historyId", "=", historyId)
    .selectAll("tag")
    .execute();
};

export const getTagHistoryIds = async (tagId: string): Promise<string[]> => {
  const db = await getDatabase();

  const result = await db
    .selectFrom("historyTag")
    .where("tagId", "=", tagId)
    .select("historyId")
    .execute();

  return result.map((r) => r.historyId);
};

export const hasTag = async (
  historyId: string,
  tagId: string,
): Promise<boolean> => {
  const db = await getDatabase();

  const result = await db
    .selectFrom("historyTag")
    .where("historyId", "=", historyId)
    .where("tagId", "=", tagId)
    .select("historyId")
    .executeTakeFirst();

  return !!result;
};
