use crate::plugins::text_expansion::listener::TextExpansionListener;
use std::collections::HashMap;
use tauri::{command, AppHandle, Runtime, State};

#[command]
#[allow(unused)]
pub fn set_text_expansion_prefix<R: Runtime>(
    _app: AppHandle<R>,
    listener: State<'_, TextExpansionListener<R>>,
    prefix: String,
) {
    listener.set_prefix(prefix);
}

#[command]
#[allow(unused)]
pub fn set_text_expansions<R: Runtime>(
    _app: AppHandle<R>,
    listener: State<'_, TextExpansionListener<R>>,
    expansions: HashMap<String, String>,
) {
    listener.set_expansions(expansions);
}

#[command]
#[allow(unused)]
pub fn set_text_expansion_enabled<R: Runtime>(
    _app: AppHandle<R>,
    listener: State<'_, TextExpansionListener<R>>,
    enabled: bool,
) {
    listener.set_enabled(enabled);
}
