import type { DatabaseSchemaTextExpansion } from "@/types/database";
import { getDatabase } from ".";

export const selectTextExpansions = async (): Promise<
  DatabaseSchemaTextExpansion[]
> => {
  const db = await getDatabase();

  return db
    .selectFrom("textExpansion")
    .selectAll()
    .orderBy("createTime", "desc")
    .execute() as Promise<DatabaseSchemaTextExpansion[]>;
};

export const insertTextExpansion = async (
  data: Omit<
    DatabaseSchemaTextExpansion,
    "id" | "createTime" | "updateTime"
  > & {
    id?: string;
    createTime?: string;
    updateTime?: string;
  },
): Promise<DatabaseSchemaTextExpansion> => {
  const db = await getDatabase();

  const now = new Date().toISOString();
  const id = data.id ?? crypto.randomUUID();

  const record: DatabaseSchemaTextExpansion = {
    content: data.content,
    createTime: data.createTime ?? now,
    id,
    sourceHistoryId: data.sourceHistoryId,
    triggerWord: data.triggerWord,
    updateTime: data.updateTime ?? now,
    variables: data.variables,
  };

  await db.insertInto("textExpansion").values(record).execute();

  return record;
};

export const updateTextExpansion = async (
  id: string,
  data: Partial<
    Omit<DatabaseSchemaTextExpansion, "id" | "createTime" | "updateTime">
  >,
): Promise<void> => {
  const db = await getDatabase();

  const now = new Date().toISOString();

  // Filter out undefined values to avoid empty SET clause
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined),
  ) as Partial<DatabaseSchemaTextExpansion>;

  if (Object.keys(filtered).length === 0) return;

  await db
    .updateTable("textExpansion")
    .set({
      ...filtered,
      updateTime: now,
    })
    .where("id", "=", id)
    .execute();
};

export const deleteTextExpansion = async (id: string): Promise<void> => {
  const db = await getDatabase();

  await db.deleteFrom("textExpansion").where("id", "=", id).execute();
};

export const checkTriggerWordExists = async (
  triggerWord: string,
  excludeId?: string,
): Promise<boolean> => {
  const db = await getDatabase();

  let query = db
    .selectFrom("textExpansion")
    .select("id")
    .where("triggerWord", "=", triggerWord);

  if (excludeId) {
    query = query.where("id", "!=", excludeId);
  }

  const result = await query.executeTakeFirst();
  return !!result;
};

export const getTextExpansionByTriggerWord = async (
  triggerWord: string,
): Promise<DatabaseSchemaTextExpansion | undefined> => {
  const db = await getDatabase();

  return db
    .selectFrom("textExpansion")
    .selectAll()
    .where("triggerWord", "=", triggerWord)
    .executeTakeFirst() as Promise<DatabaseSchemaTextExpansion | undefined>;
};
