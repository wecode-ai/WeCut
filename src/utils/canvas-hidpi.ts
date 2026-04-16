export interface CanvasLogicalSize {
  width: number;
  height: number;
}

export interface CanvasPixelSize {
  width: number;
  height: number;
}

export interface CanvasClientPoint {
  x: number;
  y: number;
}

export interface CanvasRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const normalizeDpr = (dpr: number): number => {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return dpr;
};

export const getCanvasPixelSize = (
  logicalWidth: number,
  logicalHeight: number,
  dpr: number,
): CanvasPixelSize => {
  const normalizedDpr = normalizeDpr(dpr);
  return {
    height: Math.max(1, Math.round(logicalHeight * normalizedDpr)),
    width: Math.max(1, Math.round(logicalWidth * normalizedDpr)),
  };
};

export const getCanvasLogicalSize = (
  pixelWidth: number,
  pixelHeight: number,
  dpr: number,
): CanvasLogicalSize => {
  const normalizedDpr = normalizeDpr(dpr);
  return {
    height: pixelHeight / normalizedDpr,
    width: pixelWidth / normalizedDpr,
  };
};

export const getCanvasLogicalPoint = (
  clientPoint: CanvasClientPoint,
  rect: CanvasRectLike,
  pixelSize: CanvasPixelSize,
  dpr: number,
): CanvasClientPoint => {
  const normalizedDpr = normalizeDpr(dpr);
  const scaleX = rect.width > 0 ? pixelSize.width / rect.width : 0;
  const scaleY = rect.height > 0 ? pixelSize.height / rect.height : 0;

  return {
    x: ((clientPoint.x - rect.left) * scaleX) / normalizedDpr,
    y: ((clientPoint.y - rect.top) * scaleY) / normalizedDpr,
  };
};
