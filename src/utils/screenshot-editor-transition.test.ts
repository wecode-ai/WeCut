import assert from "node:assert/strict";
import test from "node:test";
import { resolveEditorTransition } from "../pages/Screenshot/utils/editor-transition";

test("resolveEditorTransition enters editing immediately when preview exists", () => {
  const result = resolveEditorTransition("data:image/jpeg;base64,preview");

  assert.deepEqual(result, {
    initialEditorImageCropped: false,
    initialEditorImageDataUrl: "data:image/jpeg;base64,preview",
    phase: "editing",
  });
});

test("resolveEditorTransition falls back to loading when preview is empty", () => {
  const result = resolveEditorTransition("");

  assert.deepEqual(result, {
    initialEditorImageCropped: true,
    initialEditorImageDataUrl: "",
    phase: "loadingCrop",
  });
});
