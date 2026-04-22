export interface DockActionOptions<T> {
  action: () => Promise<T>;
  afterHide?: () => void;
  beforeAction?: () => void;
  hideWindow: () => Promise<unknown> | unknown;
  onResult?: (result: T) => void;
}

export const runDockAction = async <T>({
  action,
  afterHide,
  beforeAction,
  hideWindow,
  onResult,
}: DockActionOptions<T>): Promise<T> => {
  beforeAction?.();

  const result = await action();

  onResult?.(result);
  await hideWindow();
  afterHide?.();

  return result;
};
