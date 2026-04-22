import assert from "node:assert/strict";
import test from "node:test";
import { resolveToolbarPosition } from "../pages/Screenshot/components/Editor/toolbar-position";

test("resolveToolbarPosition keeps the toolbar right edge anchored when width is not measured yet", () => {
  const position = resolveToolbarPosition({
    availableHeight: 900,
    canvasOffsetX: 0,
    selection: { h: 180, w: 320, x: 120, y: 160 },
    toolbarHeight: 44,
    toolbarWidth: 0,
    viewportWidth: 1440,
  });

  assert.deepEqual(position, {
    left: 440,
    top: 350,
    transform: "translateX(-100%)",
  });
});

test("resolveToolbarPosition right-aligns the toolbar once its width is known", () => {
  const position = resolveToolbarPosition({
    availableHeight: 900,
    canvasOffsetX: 0,
    selection: { h: 180, w: 320, x: 120, y: 160 },
    toolbarHeight: 44,
    toolbarWidth: 180,
    viewportWidth: 1440,
  });

  assert.deepEqual(position, {
    left: 260,
    top: 350,
    transform: "none",
  });
});

test("resolveToolbarPosition keeps the toolbar inside the viewport near the right edge", () => {
  const position = resolveToolbarPosition({
    availableHeight: 900,
    canvasOffsetX: 0,
    selection: { h: 180, w: 120, x: 1180, y: 160 },
    toolbarHeight: 44,
    toolbarWidth: 240,
    viewportWidth: 1280,
  });

  assert.deepEqual(position, {
    left: 1032,
    top: 350,
    transform: "none",
  });
});
