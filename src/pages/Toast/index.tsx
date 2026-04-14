import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useMount } from "ahooks";
import { useEffect, useState } from "react";
import "./index.scss";

const Toast = () => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useMount(() => {
    // 窗口显示时触发动画
    setTimeout(() => setVisible(true), 50);

    // 监听窗口显示事件
    const window = getCurrentWebviewWindow();
    window.listen("tauri://focus", () => {
      setVisible(true);
      setExiting(false);
    });
  });

  useEffect(() => {
    if (visible) {
      // 1.2秒后开始退出动画
      const timer = setTimeout(() => {
        setExiting(true);
        // 动画完成后隐藏窗口
        setTimeout(() => {
          const window = getCurrentWebviewWindow();
          window.hide();
          setVisible(false);
          setExiting(false);
        }, 300);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      const window = getCurrentWebviewWindow();
      window.hide();
      setVisible(false);
      setExiting(false);
    }, 300);
  };

  return (
    <div
      className={`toast-window ${visible ? "toast-visible" : ""} ${
        exiting ? "toast-exiting" : ""
      }`}
    >
      <div className="toast-content">
        <span className="toast-message">粘贴成功</span>
        <button className="toast-close" onClick={handleClose} type="button">
          <svg
            fill="none"
            height="12"
            viewBox="0 0 12 12"
            width="12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>关闭</title>
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
    </div>
  );
};

export default Toast;
