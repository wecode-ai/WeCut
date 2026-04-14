export const MAIN_STANDARD_WINDOW_WIDTH = 360;
export const MAIN_STANDARD_WINDOW_HEIGHT = 600;

/**
 * 计算 Dock 模式的内容高度（逻辑像素）
 * 必须与 DockMode 组件中的布局保持一致
 */
export const getDockContentHeight = (dockScale: number): number => {
  const toolbarHeight = 40; // min-h-10
  const cardHeight = Math.round(280 * dockScale);
  const gap = 8; // gap-2
  const padding = 8; // p-2
  return toolbarHeight + cardHeight + 16 + gap + padding * 2;
};

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface MonitorInfo {
  cursorPoint: Point;
  position: Point;
  size: Size;
  workArea: {
    position: Point;
    size: Size;
  };
}

interface SavedWindowState extends Partial<Point & Size> {}

interface CalculateMainWindowLayoutOptions {
  style: "standard" | "dock";
  windowPosition: "remember" | "follow" | "center";
  scaleFactor: number;
  dockScale?: number;
  currentSize?: Size;
  fallbackState?: SavedWindowState;
  monitor?: MonitorInfo;
  savedState?: SavedWindowState;
}

interface MainWindowLayout {
  position?: Point;
  size?: Size;
}

const getMainStandardWindowSize = (scaleFactor: number): Size => {
  return {
    height: Math.round(MAIN_STANDARD_WINDOW_HEIGHT * scaleFactor),
    width: Math.round(MAIN_STANDARD_WINDOW_WIDTH * scaleFactor),
  };
};

export const calculateMainWindowLayout = (
  options: CalculateMainWindowLayoutOptions,
): MainWindowLayout => {
  const {
    style,
    windowPosition,
    scaleFactor,
    dockScale = 1,
    currentSize,
    fallbackState,
    monitor,
    savedState,
  } = options;

  if (style === "dock") {
    if (!monitor) return {};

    const contentHeight = getDockContentHeight(dockScale);
    const dockWindowHeight = Math.round(contentHeight * scaleFactor);

    // Use the full monitor size to position dock at the very bottom of the screen
    // This ensures the dock window sits on top of the system Dock
    return {
      position: {
        x: monitor.position.x,
        y: monitor.position.y + monitor.size.height - dockWindowHeight,
      },
      size: {
        height: dockWindowHeight,
        width: monitor.size.width,
      },
    };
  }

  if (windowPosition === "remember") {
    const targetState = fallbackState ?? savedState;
    const { x, y, width, height } = targetState ?? {};

    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof width === "number" &&
      typeof height === "number"
    ) {
      return {
        position: { x, y },
        size: { height, width },
      };
    }

    const standardWindowSize = getMainStandardWindowSize(scaleFactor);

    if (!monitor) {
      return {
        size: standardWindowSize,
      };
    }

    return {
      position: {
        x: Math.round(
          monitor.position.x +
            (monitor.size.width - standardWindowSize.width) / 2,
        ),
        y: Math.round(
          monitor.position.y +
            (monitor.size.height - standardWindowSize.height) / 2,
        ),
      },
      size: standardWindowSize,
    };
  }

  if (!monitor || !currentSize) return {};

  let { x, y } = monitor.cursorPoint;

  if (windowPosition === "follow") {
    x = Math.min(
      x,
      monitor.position.x + monitor.size.width - currentSize.width,
    );
    y = Math.min(
      y,
      monitor.position.y + monitor.size.height - currentSize.height,
    );
  } else {
    x = monitor.position.x + (monitor.size.width - currentSize.width) / 2;
    y = monitor.position.y + (monitor.size.height - currentSize.height) / 2;
  }

  return {
    position: {
      x: Math.round(x),
      y: Math.round(y),
    },
  };
};
