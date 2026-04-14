use tauri::{
    generate_handler,
    plugin::{Builder, TauriPlugin},
    Runtime,
};

mod commands;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("eco-active-app")
        .invoke_handler(generate_handler![
            commands::get_active_app,
            commands::get_app_icon
        ])
        .build()
}
