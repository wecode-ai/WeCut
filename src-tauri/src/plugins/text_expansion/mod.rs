use tauri::{
    generate_handler,
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub mod commands;
pub mod listener;
pub mod matcher;

use listener::TextExpansionListener;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("text-expansion")
        .setup(|app, _api| {
            let listener = TextExpansionListener::<R>::new(app.clone());
            listener.start();
            app.manage(listener);
            Ok(())
        })
        .invoke_handler(generate_handler![
            commands::set_text_expansion_prefix,
            commands::set_text_expansions,
            commands::set_text_expansion_enabled
        ])
        .build()
}

// State management for text expansion (reserved for future use)
#[derive(Default)]
#[allow(dead_code)]
pub struct TextExpansionState;

#[allow(dead_code)]
impl TextExpansionState {
    pub fn new() -> Self {
        Self
    }
}
