import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseSchemaHistory } from "../types/database.js";
import { touchHistoryItemInList } from "./historyActivation.js";

const createTextHistory = (
  id: string,
  value: string,
  createTime: string,
): DatabaseSchemaHistory => ({
  count: value.length,
  createTime,
  favorite: false,
  group: "text",
  id,
  search: value,
  type: "text",
  value,
});

test("touchHistoryItemInList updates the timestamp and moves the item to the front", () => {
  const list = [
    createTextHistory("1", "first", "2024-01-01 10:00:00"),
    createTextHistory("2", "second", "2024-01-01 11:00:00"),
    createTextHistory("3", "third", "2024-01-01 12:00:00"),
  ];

  touchHistoryItemInList(list, "2", "2024-01-02 09:30:00");

  assert.equal(list[0].id, "2");
  assert.equal(list[0].createTime, "2024-01-02 09:30:00");
  assert.deepEqual(
    list.map((item) => item.id),
    ["2", "1", "3"],
  );
});

test("touchHistoryItemInList updates the timestamp even when the item is already first", () => {
  const list = [createTextHistory("1", "first", "2024-01-01 10:00:00")];

  touchHistoryItemInList(list, "1", "2024-01-02 09:30:00");

  assert.equal(list[0].id, "1");
  assert.equal(list[0].createTime, "2024-01-02 09:30:00");
});
