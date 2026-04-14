const COMMANDS: &[&str] = &[
    "set_text_expansion_prefix",
    "set_text_expansions",
    "set_text_expansion_enabled",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
