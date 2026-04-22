import type { DatabaseSchemaHistory } from "../types/database.js";

export const touchHistoryItemInList = (
  list: DatabaseSchemaHistory[],
  id: string,
  createTime: string,
): boolean => {
  const index = list.findIndex((item) => item.id === id);

  if (index === -1) {
    return false;
  }

  const [item] = list.splice(index, 1);
  item.createTime = createTime;
  list.unshift(item);

  return true;
};
