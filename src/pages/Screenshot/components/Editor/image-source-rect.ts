import type { Selection } from "./types";

export interface ResolveImageSourceRectOptions {
  imageWidth: number;
  imageHeight: number;
  logicalWidth: number;
  logicalHeight: number;
  selection: Selection;
}

export interface ImageSourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const resolveImageSourceRect = ({
  imageWidth,
  imageHeight,
  logicalWidth,
  logicalHeight,
  selection,
}: ResolveImageSourceRectOptions): ImageSourceRect => {
  const safeLogicalWidth = Math.max(1, logicalWidth);
  const safeLogicalHeight = Math.max(1, logicalHeight);
  const scaleX = imageWidth / safeLogicalWidth;
  const scaleY = imageHeight / safeLogicalHeight;

  const sx = Math.max(0, Math.floor(selection.x * scaleX));
  const sy = Math.max(0, Math.floor(selection.y * scaleY));
  const sw = Math.max(1, Math.round(selection.w * scaleX));
  const sh = Math.max(1, Math.round(selection.h * scaleY));

  return {
    sh: Math.min(sh, Math.max(1, imageHeight - sy)),
    sw: Math.min(sw, Math.max(1, imageWidth - sx)),
    sx: Math.min(sx, Math.max(0, imageWidth - 1)),
    sy: Math.min(sy, Math.max(0, imageHeight - 1)),
  };
};
