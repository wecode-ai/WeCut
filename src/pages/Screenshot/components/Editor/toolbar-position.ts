import type { Selection } from "./types";

export interface ResolveToolbarPositionOptions {
  availableHeight: number;
  canvasOffsetX: number;
  selection: Selection;
  toolbarHeight: number;
  toolbarWidth: number;
  viewportWidth: number;
}

export interface ToolbarPosition {
  left: number;
  top: number;
  transform: string;
}

const SCREEN_MARGIN = 8;
const TOOLBAR_GAP = 10;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const resolveToolbarPosition = ({
  availableHeight,
  canvasOffsetX,
  selection,
  toolbarHeight,
  toolbarWidth,
  viewportWidth,
}: ResolveToolbarPositionOptions): ToolbarPosition => {
  const toolbarMeasured = toolbarWidth > 0;
  const anchorRight = selection.x + canvasOffsetX + selection.w;
  const left = toolbarMeasured
    ? clamp(
        anchorRight - toolbarWidth,
        SCREEN_MARGIN,
        viewportWidth - toolbarWidth - SCREEN_MARGIN,
      )
    : clamp(anchorRight, SCREEN_MARGIN, viewportWidth - SCREEN_MARGIN);
  const transform = toolbarMeasured ? "none" : "translateX(-100%)";

  const toolbarBottomAbs =
    selection.y + selection.h + TOOLBAR_GAP + toolbarHeight;
  const availBottom = availableHeight - SCREEN_MARGIN;
  if (toolbarHeight === 0 || toolbarBottomAbs <= availBottom) {
    return {
      left,
      top: selection.y + selection.h + TOOLBAR_GAP,
      transform,
    };
  }

  const toolbarTopAbs = selection.y - TOOLBAR_GAP - toolbarHeight;
  if (toolbarTopAbs >= 0) {
    return {
      left,
      top: toolbarTopAbs,
      transform,
    };
  }

  return {
    left: toolbarMeasured
      ? anchorRight - toolbarWidth - SCREEN_MARGIN
      : anchorRight - SCREEN_MARGIN,
    top: selection.y + SCREEN_MARGIN,
    transform,
  };
};
