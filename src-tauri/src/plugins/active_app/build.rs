const COMMANDS: &[&str] = &["get_active_app", "get_app_icon"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
