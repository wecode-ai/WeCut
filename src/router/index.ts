import { createHashRouter } from "react-router-dom";
import Main from "@/pages/Main";
import Preference from "@/pages/Preference";
import Screenshot from "@/pages/Screenshot";
import SendModal from "@/pages/SendModal";
import Toast from "@/pages/Toast";

export const router = createHashRouter([
  {
    Component: Main,
    path: "/",
  },
  {
    Component: Preference,
    path: "/preference",
  },
  {
    Component: Toast,
    path: "/toast",
  },
  {
    Component: SendModal,
    path: "/send-modal",
  },
  {
    Component: Screenshot,
    path: "/screenshot",
  },
]);
