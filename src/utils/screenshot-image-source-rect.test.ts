import assert from "node:assert/strict";
import test from "node:test";
import { resolveImageSourceRect } from "../pages/Screenshot/components/Editor/image-source-rect";

test("resolveImageSourceRect keeps 1x source mapping when natural and logical sizes match", () => {
  const source = resolveImageSourceRect({
    imageHeight: 1080,
    imageWidth: 1920,
    logicalHeight: 1080,
    logicalWidth: 1920,
    selection: { h: 200, w: 300, x: 120, y: 80 },
  });

  assert.deepEqual(source, {
    sh: 200,
    sw: 300,
    sx: 120,
    sy: 80,
  });
});

test("resolveImageSourceRect scales source mapping for 2x natural image", () => {
  const source = resolveImageSourceRect({
    imageHeight: 2160,
    imageWidth: 3840,
    logicalHeight: 1080,
    logicalWidth: 1920,
    selection: { h: 200, w: 300, x: 120, y: 80 },
  });

  assert.deepEqual(source, {
    sh: 400,
    sw: 600,
    sx: 240,
    sy: 160,
  });
});
