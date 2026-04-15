import { useState } from "react";
import UnoIcon from "@/components/UnoIcon";

interface MiniButtonProps {
  icon: string;
  onClick: () => void;
  title?: string;
}

const MiniButton: React.FC<MiniButtonProps> = ({ icon, onClick, title }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        alignItems: "center",
        background: hovered ? "rgba(255,255,255,0.22)" : "rgba(20,20,20,0.75)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 6,
        color: "#ffffff",
        cursor: "pointer",
        display: "flex",
        justifyContent: "center",
        padding: 5,
        transition: "background 0.15s",
      }}
      title={title}
      type="button"
    >
      <UnoIcon name={icon} size={14} />
    </button>
  );
};

export default MiniButton;
