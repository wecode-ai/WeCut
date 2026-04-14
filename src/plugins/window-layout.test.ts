import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMainWindowLayout,
  getDockContentHeight,
  MAIN_STANDARD_WINDOW_HEIGHT,
  MAIN_STANDARD_WINDOW_WIDTH,
} from "./window-layout";

test("dock layout converts logical height to physical height and anchors to monitor bottom", () => {
  const result = calculateMainWindowLayout({
    monitor: {
      cursorPoint: { x: 100, y: 100 },
      position: { x: 1440, y: 50 },
      size: { height: 1800, width: 3024 },
      workArea: {
        position: { x: 1440, y: 50 },
        size: { height: 1700, width: 3024 },
      },
    },
    scaleFactor: 2,
    style: "dock",
    windowPosition: "remember",
  });

  const dockHeight = getDockContentHeight(1) * 2; // logical height * scaleFactor

  assert.deepEqual(result, {
    position: {
      x: 1440,
      y: 50 + 1800 - dockHeight,
    },
    size: {
      height: dockHeight,
      width: 3024,
    },
  });
});

test("standard remember restores saved window geometry", () => {
  const result = calculateMainWindowLayout({
    monitor: {
      cursorPoint: { x: 600, y: 400 },
      position: { x: 0, y: 0 },
      size: { height: 1800, width: 3024 },
      workArea: {
        position: { x: 0, y: 50 },
        size: { height: 1750, width: 3024 },
      },
    },
    savedState: {
      height: 720,
      width: 420,
      x: 220,
      y: 160,
    },
    scaleFactor: 2,
    style: "standard",
    windowPosition: "remember",
  });

  assert.deepEqual(result, {
    position: { x: 220, y: 160 },
    size: { height: 720, width: 420 },
  });
});

test("standard remember falls back to in-session standard geometry when no saved state exists", () => {
  const result = calculateMainWindowLayout({
    fallbackState: {
      height: 680,
      width: 380,
      x: 180,
      y: 120,
    },
    monitor: {
      cursorPoint: { x: 600, y: 400 },
      position: { x: 0, y: 0 },
      size: { height: 1800, width: 3024 },
      workArea: {
        position: { x: 0, y: 50 },
        size: { height: 1750, width: 3024 },
      },
    },
    scaleFactor: 2,
    style: "standard",
    windowPosition: "remember",
  });

  assert.deepEqual(result, {
    position: { x: 180, y: 120 },
    size: { height: 680, width: 380 },
  });
});

test("standard remember falls back to centered default geometry when no state exists", () => {
  const result = calculateMainWindowLayout({
    monitor: {
      cursorPoint: { x: 600, y: 400 },
      position: { x: 0, y: 0 },
      size: { height: 1800, width: 3024 },
      workArea: {
        position: { x: 0, y: 50 },
        size: { height: 1750, width: 3024 },
      },
    },
    scaleFactor: 2,
    style: "standard",
    windowPosition: "remember",
  });

  assert.deepEqual(result, {
    position: {
      x: Math.round((3024 - MAIN_STANDARD_WINDOW_WIDTH * 2) / 2),
      y: Math.round((1800 - MAIN_STANDARD_WINDOW_HEIGHT * 2) / 2),
    },
    size: {
      height: MAIN_STANDARD_WINDOW_HEIGHT * 2,
      width: MAIN_STANDARD_WINDOW_WIDTH * 2,
    },
  });
});
