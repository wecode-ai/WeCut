import type { DrawTool } from "../Toolbar";

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 8 个控制点类型
export type HandleType = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

export type ShapeType = DrawTool;

export interface BaseShape {
  type: ShapeType;
  color: string;
  lineWidth: number;
}

export interface RectShape extends BaseShape {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EllipseShape extends BaseShape {
  type: "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArrowShape extends BaseShape {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TextShape extends BaseShape {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface PenShape extends BaseShape {
  type: "pen";
  points: { x: number; y: number }[];
}

export interface MosaicShape extends BaseShape {
  type: "mosaic";
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Shape =
  | RectShape
  | EllipseShape
  | ArrowShape
  | TextShape
  | PenShape
  | MosaicShape;

export interface EditorProps {
  bgImage: string;
  /** bgImage 已经是裁剪好的选区图片（不需要再用 selection.x/y 偏移裁剪） */
  bgImageCropped?: boolean;
  selection: Selection;
  onClose: () => void;
  onMove?: (sel: Selection) => void;
  onResize?: (sel: Selection) => void;
  onPin?: (dataUrl: string) => void;
  onSendToWegent?: (dataUrl: string) => void;
  pinned?: boolean;
  initialToolbarExpanded?: boolean;
  /** pin 模式下窗口最小宽度，默认 800；传 0 表示不强制最小宽度 */
  pinMinWidth?: number;
}
