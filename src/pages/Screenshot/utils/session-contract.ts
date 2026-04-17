export interface ScreenshotPreviewPayloadRaw {
  preview_image_data_url: string;
  selection_source: string;
  w: number;
  h: number;
  logical_w: number;
  logical_h: number;
  label: string;
  monitor_id: number;
}

export interface ScreenshotPreviewPayload {
  previewImageDataUrl: string;
  selectionSource: string;
  w: number;
  h: number;
  logicalWidth: number;
  logicalHeight: number;
  label: string;
  monitorId: number;
}

export interface ScreenshotSelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const mapScreenshotPreviewPayload = (
  raw: ScreenshotPreviewPayloadRaw,
): ScreenshotPreviewPayload => {
  return {
    h: raw.h,
    label: raw.label,
    logicalHeight: raw.logical_h,
    logicalWidth: raw.logical_w,
    monitorId: raw.monitor_id,
    previewImageDataUrl: raw.preview_image_data_url,
    selectionSource: raw.selection_source,
    w: raw.w,
  };
};

export const toCropRequest = (
  selection: ScreenshotSelectionRect,
): ScreenshotSelectionRect => {
  return {
    h: Math.max(1, Math.round(selection.h)),
    w: Math.max(1, Math.round(selection.w)),
    x: Math.max(0, Math.floor(selection.x)),
    y: Math.max(0, Math.floor(selection.y)),
  };
};
