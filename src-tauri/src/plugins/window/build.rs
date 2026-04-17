const COMMANDS: &[&str] = &[
    "show_window",
    "hide_window",
    "show_taskbar_icon",
    "show_toast_window",
    "hide_toast_window",
    "show_send_modal_window",
    "hide_send_modal_window",
    "close_send_modal_window",
    "show_onboarding_window",
    "hide_onboarding_window",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
