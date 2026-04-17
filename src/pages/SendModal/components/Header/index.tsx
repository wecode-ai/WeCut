import { CloseOutlined } from "@ant-design/icons";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import UnoIcon from "@/components/UnoIcon";
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
        <div className="header-icon-wrap">
          <UnoIcon
            className="header-icon"
            name={isAiChat ? "i-lucide:bot" : "i-lucide:send"}
            size={13}
          />
        </div>
        <span className="header-title-text">{title}</span>
      </div>
      <button
        className="send-modal-header-close"
        onClick={handleClose}
        type="button"
      >
        <CloseOutlined style={{ fontSize: 11 }} />
      </button>
    </div>
  );
};

export default Header;
