import { CloseOutlined, RobotOutlined, SendOutlined } from "@ant-design/icons";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Button } from "antd";
import "./index.scss";

interface HeaderProps {
  title: string;
  isAiChat?: boolean;
}

const Header = ({ title, isAiChat = false }: HeaderProps) => {
  const handleClose = async () => {
    const window = getCurrentWebviewWindow();
    await window.close();
  };

  return (
    <div className="send-modal-header" data-tauri-drag-region>
      <div className="send-modal-header-title" data-tauri-drag-region>
        {isAiChat ? (
          <RobotOutlined className="header-icon" />
        ) : (
          <SendOutlined className="header-icon" />
        )}
        {title}
      </div>
      <Button
        className="send-modal-header-close"
        icon={<CloseOutlined />}
        onClick={handleClose}
        type="text"
      />
    </div>
  );
};

export default Header;
