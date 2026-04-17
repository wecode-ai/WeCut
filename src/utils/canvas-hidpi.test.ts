import assert from "node:assert/strict";
import test from "node:test";
import {
  getCanvasLogicalPoint,
  getCanvasLogicalSize,
  getCanvasPixelSize,
} from "./canvas-hidpi";

test("getCanvasPixelSize - scales logical size with DPR", () => {
  const size = getCanvasPixelSize(1920, 1080, 2);
  assert.deepEqual(size, { height: 2160, width: 3840 });
});

test("getCanvasPixelSize - falls back to DPR=1 for invalid DPR", () => {
  const size = getCanvasPixelSize(800, 600, 0);
  assert.deepEqual(size, { height: 600, width: 800 });
});

test("getCanvasLogicalSize - restores logical size from pixel size", () => {
  const logical = getCanvasLogicalSize(3000, 2000, 2);
  assert.deepEqual(logical, { height: 1000, width: 1500 });
});

test("getCanvasLogicalPoint - maps client coordinates to logical canvas coordinates", () => {
  const point = getCanvasLogicalPoint(
    { x: 250, y: 150 },
    { height: 200, left: 100, top: 50, width: 300 },
    { height: 400, width: 600 },
    2,
  );

  assert.deepEqual(point, { x: 150, y: 100 });
});
