use tauri::{
    generate_handler,
    plugin::{Builder, TauriPlugin},
    Runtime,
};

mod commands;

pub use commands::*;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("eco-window")
        .invoke_handler(generate_handler![
            commands::show_window,
            commands::hide_window,
            commands::show_taskbar_icon,
            commands::show_toast_window,
            commands::hide_toast_window,
            commands::show_send_modal_window,
            commands::hide_send_modal_window,
            commands::close_send_modal_window,
            commands::show_onboarding_window,
            commands::hide_onboarding_window,
        ])
        .build()
}
