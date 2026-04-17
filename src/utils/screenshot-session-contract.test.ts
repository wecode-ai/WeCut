import assert from "node:assert/strict";
import test from "node:test";
import {
  mapScreenshotPreviewPayload,
  toCropRequest,
} from "../pages/Screenshot/utils/session-contract";

test("mapScreenshotPreviewPayload maps snake_case payload to screenshot preview contract", () => {
  const mapped = mapScreenshotPreviewPayload({
    h: 1080,
    label: "screenshot",
    logical_h: 1080,
    logical_w: 1920,
    monitor_id: 1,
    preview_image_data_url: "data:image/jpeg;base64,abc",
    selection_source: "preview-fast-path",
    w: 1920,
  });

  assert.deepEqual(mapped, {
    h: 1080,
    label: "screenshot",
    logicalHeight: 1080,
    logicalWidth: 1920,
    monitorId: 1,
    previewImageDataUrl: "data:image/jpeg;base64,abc",
    selectionSource: "preview-fast-path",
    w: 1920,
  });
});

test("toCropRequest rounds and clamps selection for rust crop command", () => {
  const request = toCropRequest({
    h: 0.2,
    w: 35.6,
    x: -2.7,
    y: 19.4,
  });

  assert.deepEqual(request, {
    h: 1,
    w: 36,
    x: 0,
    y: 19,
  });
});
