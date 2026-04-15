import type { MosaicShape, Shape } from "./types";

/** 根据控制点类型返回对应的 CSS cursor */
export function getHandleCursor(
  handle: "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se",
): string {
  switch (handle) {
    case "nw":
      return "nw-resize";
    case "n":
      return "n-resize";
    case "ne":
      return "ne-resize";
    case "w":
      return "w-resize";
    case "e":
      return "e-resize";
    case "sw":
      return "sw-resize";
    case "s":
      return "s-resize";
    case "se":
      return "se-resize";
  }
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lw: number,
) {
  const headLen = Math.max(12, lw * 4);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

export function drawMosaic(
  ctx: CanvasRenderingContext2D,
  shape: MosaicShape,
  bgCanvas: HTMLCanvasElement,
) {
  const bgCtx = bgCanvas.getContext("2d");
  if (!bgCtx) return;

  const blockSize = 8;
  const { h, w, x, y } = shape;
  const normX = w < 0 ? x + w : x;
  const normY = h < 0 ? y + h : y;
  const normW = Math.abs(w);
  const normH = Math.abs(h);

  for (let bx = normX; bx < normX + normW; bx += blockSize) {
    for (let by = normY; by < normY + normH; by += blockSize) {
      const sampleX = Math.min(bx, bgCanvas.width - 1);
      const sampleY = Math.min(by, bgCanvas.height - 1);
      const pixel = bgCtx.getImageData(sampleX, sampleY, 1, 1).data;
      ctx.fillStyle = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3] / 255})`;
      const bw = Math.min(blockSize, normX + normW - bx);
      const bh = Math.min(blockSize, normY + normH - by);
      ctx.fillRect(bx, by, bw, bh);
    }
  }
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  bgCanvas: HTMLCanvasElement | null,
) {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (shape.type) {
    case "rect": {
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      break;
    }
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse(
        shape.x + shape.w / 2,
        shape.y + shape.h / 2,
        Math.abs(shape.w / 2),
        Math.abs(shape.h / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      break;
    }
    case "arrow": {
      drawArrow(ctx, shape.x1, shape.y1, shape.x2, shape.y2, shape.lineWidth);
      break;
    }
    case "text": {
      ctx.font = `500 ${shape.fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = shape.color;
      ctx.globalAlpha = 1;
      ctx.fillText(shape.text, shape.x, shape.y);
      break;
    }
    case "pen": {
      if (shape.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.stroke();
      break;
    }
    case "mosaic": {
      if (bgCanvas) drawMosaic(ctx, shape, bgCanvas);
      break;
    }
  }
  ctx.restore();
}

/** Hit test: returns the index of the topmost committed shape at (px, py), or -1 */
export function hitTestShape(px: number, py: number, shapes: Shape[]): number {
  const HIT_PADDING = 6;
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    switch (shape.type) {
      case "rect":
      case "ellipse":
      case "mosaic": {
        const normX = shape.w < 0 ? shape.x + shape.w : shape.x;
        const normY = shape.h < 0 ? shape.y + shape.h : shape.y;
        const normW = Math.abs(shape.w);
        const normH = Math.abs(shape.h);
        if (
          px >= normX - HIT_PADDING &&
          px <= normX + normW + HIT_PADDING &&
          py >= normY - HIT_PADDING &&
          py <= normY + normH + HIT_PADDING
        ) {
          return i;
        }
        break;
      }
      case "text": {
        const textW = shape.text.length * shape.fontSize * 0.6;
        const textH = shape.fontSize;
        if (
          px >= shape.x - HIT_PADDING &&
          px <= shape.x + textW + HIT_PADDING &&
          py >= shape.y - textH - HIT_PADDING &&
          py <= shape.y + HIT_PADDING
        ) {
          return i;
        }
        break;
      }
      case "arrow": {
        const dx = shape.x2 - shape.x1;
        const dy = shape.y2 - shape.y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) break;
        const t = Math.max(
          0,
          Math.min(1, ((px - shape.x1) * dx + (py - shape.y1) * dy) / lenSq),
        );
        const closestX = shape.x1 + t * dx;
        const closestY = shape.y1 + t * dy;
        const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
        if (dist <= HIT_PADDING + shape.lineWidth) return i;
        break;
      }
      case "pen": {
        for (let j = 1; j < shape.points.length; j++) {
          const p1 = shape.points[j - 1];
          const p2 = shape.points[j];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          const t = Math.max(
            0,
            Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq),
          );
          const closestX = p1.x + t * dx;
          const closestY = p1.y + t * dy;
          const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
          if (dist <= HIT_PADDING + shape.lineWidth) return i;
        }
        break;
      }
    }
  }
  return -1;
}

/** Move a shape by (dx, dy), returning a new shape with updated coordinates */
export function moveShape(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.type) {
    case "rect":
    case "ellipse":
    case "mosaic":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "text":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "arrow":
      return {
        ...shape,
        x1: shape.x1 + dx,
        x2: shape.x2 + dx,
        y1: shape.y1 + dy,
        y2: shape.y2 + dy,
      };
    case "pen":
      return {
        ...shape,
        points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
  }
}
