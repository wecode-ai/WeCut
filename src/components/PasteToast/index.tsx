import { useBoolean } from "ahooks";
import clsx from "clsx";
import { type FC, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./index.scss";

export interface PasteToastProps {
  message?: string;
  duration?: number;
  onClose?: () => void;
  visible: boolean;
}

const PasteToast: FC<PasteToastProps> = ({
  message = "粘贴成功",
  duration = 2000,
  onClose,
  visible,
}) => {
  const [exiting, { setTrue: startExit, setFalse: resetExit }] =
    useBoolean(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      resetExit();

      // 自动关闭
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        startExit();
        // 动画结束后真正关闭
        setTimeout(() => {
          onClose?.();
        }, 300);
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, duration, onClose, startExit, resetExit]);

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    startExit();
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  if (!visible) return null;

  return createPortal(
    <div
      className={clsx("paste-toast-container", {
        "paste-toast-exiting": exiting,
      })}
    >
      <div className="paste-toast-content">
        <span className="paste-toast-message">{message}</span>
        <button
          className="paste-toast-close"
          onClick={handleClose}
          type="button"
        >
          <svg
            fill="none"
            height="12"
            viewBox="0 0 12 12"
            width="12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Close</title>
            <path
              d="M1.5 1.5L6 6M6 6L10.5 10.5M6 6L10.5 1.5M6 6L1.5 10.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default PasteToast;
