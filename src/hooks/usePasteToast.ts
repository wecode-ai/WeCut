import { useBoolean } from "ahooks";
import { useCallback } from "react";

export const usePasteToast = () => {
  const [visible, { setTrue: show, setFalse: hide }] = useBoolean(false);

  const showToast = useCallback(() => {
    show();
  }, [show]);

  const hideToast = useCallback(() => {
    hide();
  }, [hide]);

  return {
    hideToast,
    showToast,
    visible,
  };
};
