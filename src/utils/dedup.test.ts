import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseSchemaHistory } from "../types/database.js";
import {
  checkDuplicate,
  type DedupContext,
  type DedupResult,
  removeFromList,
  shouldShowInGroup,
} from "./dedup.js";

// 创建测试用的 history 记录
const createTextHistory = (
  id: string,
  value: string,
  group = "text",
): DatabaseSchemaHistory => ({
  count: 1,
  createTime: "2024-01-01",
  favorite: false,
  group,
  id,
  search: value,
  type: "text",
  value,
});

const createImageHistory = (
  id: string,
  value: string,
): DatabaseSchemaHistory => ({
  count: 1,
  createTime: "2024-01-01",
  favorite: false,
  group: "image",
  height: 100,
  id,
  search: "image",
  type: "image",
  value,
  width: 100,
});

const createFilesHistory = (
  id: string,
  value: string[],
): DatabaseSchemaHistory => ({
  count: 1,
  createTime: "2024-01-01",
  favorite: false,
  group: "files",
  id,
  search: value.join(" "),
  type: "files",
  value,
});

test("checkDuplicate - 找到完全匹配的记录", () => {
  const existing = createTextHistory("old-1", "hello world");

  const result = checkDuplicate("text", "hello world", [existing]);

  assert.equal(result?.id, "old-1");
});

test("checkDuplicate - 未找到匹配的记录（type不同）", () => {
  const existing = createTextHistory("old-1", "hello world");

  const result = checkDuplicate("image", "hello world", [existing]);

  assert.equal(result, undefined);
});

test("checkDuplicate - 未找到匹配的记录（value不同）", () => {
  const existing = createTextHistory("old-1", "hello world");

  const result = checkDuplicate("text", "different text", [existing]);

  assert.equal(result, undefined);
});

test("shouldShowInGroup - all分组显示所有记录", () => {
  assert.equal(shouldShowInGroup("all", "text"), true);
  assert.equal(shouldShowInGroup("all", "image"), true);
  assert.equal(shouldShowInGroup("all", "files"), true);
});

test("shouldShowInGroup - 特定分组只显示对应记录", () => {
  assert.equal(shouldShowInGroup("text", "text"), true);
  assert.equal(shouldShowInGroup("text", "image"), false);
  assert.equal(shouldShowInGroup("image", "image"), true);
  assert.equal(shouldShowInGroup("image", "text"), false);
});

test("removeFromList - 成功移除存在的记录", () => {
  const list: DatabaseSchemaHistory[] = [
    createTextHistory("1", "a"),
    createTextHistory("2", "b"),
    createTextHistory("3", "c"),
  ];

  const result = removeFromList(list, "2");

  assert.equal(result, true);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, "1");
  assert.equal(list[1].id, "3");
});

test("removeFromList - 移除不存在的记录返回false", () => {
  const list: DatabaseSchemaHistory[] = [createTextHistory("1", "a")];

  const result = removeFromList(list, "non-existent");

  assert.equal(result, false);
  assert.equal(list.length, 1);
});

test("removeFromList - 空列表处理", () => {
  const list: DatabaseSchemaHistory[] = [];

  const result = removeFromList(list, "any-id");

  assert.equal(result, false);
  assert.equal(list.length, 0);
});

test("去重场景 - 相同分组内的去重", () => {
  // 场景：复制相同的文本两次，都在 all 分组下查看
  const context: DedupContext = {
    currentGroup: "all",
    list: [createTextHistory("old-1", "hello")],
  };

  const newItem = createTextHistory("new-1", "hello");

  const result: DedupResult = {
    matched: context.list[0],
    shouldAddNew: shouldShowInGroup(context.currentGroup, newItem.group),
    shouldRemoveOld: shouldShowInGroup(
      context.currentGroup,
      context.list[0].group,
    ),
  };

  assert.equal(result.matched?.id, "old-1");
  assert.equal(result.shouldRemoveOld, true);
  assert.equal(result.shouldAddNew, true);

  // 执行移除和添加
  if (result.shouldRemoveOld) {
    removeFromList(context.list, result.matched!.id);
  }
  if (result.shouldAddNew) {
    context.list.unshift(newItem);
  }

  // 最终应该只有新记录
  assert.equal(context.list.length, 1);
  assert.equal(context.list[0].id, "new-1");
});

test("去重场景 - 不同分组的可见性判断", () => {
  // 场景：当前在 text 分组，但旧记录是 image 类型
  const oldRecord = createImageHistory("old-img", "/path/to/img.png");

  // 这里有个 bug：如果用新记录的 group 判断旧记录的可见性
  // 可能会错误地不移除旧记录
  const currentGroup = "text";

  // 正确的方法：用旧记录自己的 group 判断
  const oldVisible = shouldShowInGroup(currentGroup, oldRecord.group);
  assert.equal(oldVisible, false);

  // 如果错误地用新记录的分组判断
  const newRecordGroup = "text";
  const wrongVisible = shouldShowInGroup(currentGroup, newRecordGroup);
  assert.equal(wrongVisible, true); // 错误！旧记录实际上不应该显示
});

test("去重场景 - files类型", () => {
  const existing = createFilesHistory("old-file", ["/path/to/file.txt"]);

  const result = checkDuplicate("files", ["/path/to/file.txt"], [existing]);

  assert.equal(result?.id, "old-file");
});

test("去重场景 - image类型", () => {
  const existing = createImageHistory("old-img", "/path/to/img.png");

  const result = checkDuplicate("image", "/path/to/img.png", [existing]);

  assert.equal(result?.id, "old-img");
});
