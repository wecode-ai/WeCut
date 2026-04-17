export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimary?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolve monitor index by a desktop point.
 * Falls back to primary monitor, then index 0.
 */
export const resolveMonitorIndexFromPoint = (
  monitors: MonitorBounds[],
  point: Point,
): number => {
  if (monitors.length === 0) return 0;

  const hitIndex = monitors.findIndex((monitor) => {
    const withinX = point.x >= monitor.x && point.x < monitor.x + monitor.width;
    const withinY =
      point.y >= monitor.y && point.y < monitor.y + monitor.height;
    return withinX && withinY;
  });
  if (hitIndex >= 0) return hitIndex;

  const primaryIndex = monitors.findIndex((monitor) => monitor.isPrimary);
  if (primaryIndex >= 0) return primaryIndex;

  return 0;
};

/**
 * Convert monitor-local selection coordinates to global desktop coordinates.
 */
export const toGlobalSelection = (
  selection: SelectionRect,
  monitorOrigin: Pick<MonitorBounds, "x" | "y">,
): SelectionRect => {
  return {
    ...selection,
    x: selection.x + monitorOrigin.x,
    y: selection.y + monitorOrigin.y,
  };
};
