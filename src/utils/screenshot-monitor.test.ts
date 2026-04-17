import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveMonitorIndexFromPoint,
  toGlobalSelection,
} from "./screenshot-monitor.js";

test("resolveMonitorIndexFromPoint - returns index for point inside monitor", () => {
  const index = resolveMonitorIndexFromPoint(
    [
      {
        height: 1080,
        isPrimary: true,
        width: 1920,
        x: 0,
        y: 0,
      },
      {
        height: 1440,
        isPrimary: false,
        width: 2560,
        x: 1920,
        y: 0,
      },
    ],
    { x: 2200, y: 600 },
  );

  assert.equal(index, 1);
});

test("resolveMonitorIndexFromPoint - falls back to primary monitor", () => {
  const index = resolveMonitorIndexFromPoint(
    [
      {
        height: 1080,
        isPrimary: false,
        width: 1920,
        x: -1920,
        y: 0,
      },
      {
        height: 1080,
        isPrimary: true,
        width: 1920,
        x: 0,
        y: 0,
      },
    ],
    { x: 8000, y: 8000 },
  );

  assert.equal(index, 1);
});

test("resolveMonitorIndexFromPoint - falls back to index 0 when no primary", () => {
  const index = resolveMonitorIndexFromPoint(
    [
      {
        height: 1080,
        isPrimary: false,
        width: 1920,
        x: 0,
        y: 0,
      },
      {
        height: 1080,
        isPrimary: false,
        width: 1920,
        x: 1920,
        y: 0,
      },
    ],
    { x: -999, y: -999 },
  );

  assert.equal(index, 0);
});

test("toGlobalSelection - translates local selection by monitor origin", () => {
  const result = toGlobalSelection(
    { h: 300, w: 500, x: 20, y: 30 },
    { x: 1920, y: -200 },
  );

  assert.deepEqual(result, { h: 300, w: 500, x: 1940, y: -170 });
});
