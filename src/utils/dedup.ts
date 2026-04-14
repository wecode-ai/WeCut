import type {
  DatabaseSchemaGroupId,
  DatabaseSchemaHistory,
} from "../types/database.js";

/**
 * 检查是否重复
 * @param type - 内容类型
 * @param value - 内容值
 * @param list - 现有列表
 * @returns 匹配到的旧记录，如果没有则返回 undefined
 */
export const checkDuplicate = (
  type: string,
  value: string | string[],
  list: DatabaseSchemaHistory[],
): DatabaseSchemaHistory | undefined => {
  // 将 value 统一转为字符串比较
  const valueStr = Array.isArray(value) ? JSON.stringify(value) : value;

  return list.find((item) => {
    const itemValueStr = Array.isArray(item.value)
      ? JSON.stringify(item.value)
      : item.value;
    return item.type === type && itemValueStr === valueStr;
  });
};

/**
 * 判断记录是否应该显示在当前分组
 * @param currentGroup - 当前分组
 * @param recordGroup - 记录的分组
 * @returns 是否应该显示
 */
export const shouldShowInGroup = (
  currentGroup: DatabaseSchemaGroupId,
  recordGroup: string,
): boolean => {
  return currentGroup === "all" || currentGroup === recordGroup;
};

/**
 * 从列表中移除指定记录
 * @param list - 列表数组
 * @param id - 要移除的记录 ID
 * @returns 是否成功移除
 */
export const removeFromList = (
  list: DatabaseSchemaHistory[],
  id: string,
): boolean => {
  const index = list.findIndex((item) => item.id === id);

  if (index === -1) {
    return false;
  }

  list.splice(index, 1);
  return true;
};

/**
 * 去重上下文
 */
export interface DedupContext {
  currentGroup: DatabaseSchemaGroupId;
  list: DatabaseSchemaHistory[];
}

/**
 * 去重结果
 */
export interface DedupResult {
  matched?: DatabaseSchemaHistory;
  shouldRemoveOld: boolean;
  shouldAddNew: boolean;
}

/**
 * 计算去重操作
 * @param newItem - 新记录
 * @param context - 上下文
 * @returns 去重结果
 */
export const calculateDedup = (
  newItem: DatabaseSchemaHistory,
  context: DedupContext,
): DedupResult => {
  const matched = checkDuplicate(newItem.type, newItem.value, context.list);

  const shouldRemoveOld = matched
    ? shouldShowInGroup(context.currentGroup, matched.group)
    : false;

  const shouldAddNew = shouldShowInGroup(context.currentGroup, newItem.group);

  return {
    matched,
    shouldAddNew,
    shouldRemoveOld,
  };
};
