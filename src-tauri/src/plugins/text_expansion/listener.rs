use crate::plugins::text_expansion::matcher::TextMatcher;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Runtime};

#[cfg(target_os = "macos")]
use core_foundation::runloop::{kCFRunLoopDefaultMode, CFRunLoop};
#[cfg(target_os = "macos")]
use core_graphics::event::{CGEventTap, CGEventTapLocation, CGEventType};

/// Text expansion keyboard listener
pub struct TextExpansionListener<R: Runtime> {
    _app: AppHandle<R>,
    matcher: Arc<Mutex<TextMatcher>>,
    enabled: Arc<Mutex<bool>>,
}

impl<R: Runtime> TextExpansionListener<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self {
            _app: app,
            matcher: Arc::new(Mutex::new(TextMatcher::new(";;".to_string()))),
            enabled: Arc::new(Mutex::new(true)),
        }
    }

    pub fn start(&self) {
        #[cfg(target_os = "macos")]
        self.start_macos();

        #[cfg(not(target_os = "macos"))]
        {
            println!("Text expansion: macOS only feature");
        }
    }

    #[cfg(target_os = "macos")]
    fn start_macos(&self) {
        use std::thread;

        let matcher = self.matcher.clone();
        let enabled = self.enabled.clone();
        let app = self._app.clone();

        thread::spawn(move || {
            // Create event tap for key down events
            let tap = CGEventTap::new(
                CGEventTapLocation::Session,
                core_graphics::event::CGEventTapPlacement::HeadInsertEventTap,
                core_graphics::event::CGEventTapOptions::Default,
                vec![CGEventType::KeyDown],
                move |_proxy, event_type, event| {
                    match event_type {
                        CGEventType::KeyDown => {
                            // Check if enabled
                            if let Ok(is_enabled) = enabled.lock() {
                                if !*is_enabled {
                                    return Some(event.clone());
                                }
                            }

                            // Get key code
                            let key_code = event.get_integer_value_field(
                                core_graphics::event::EventField::KEYBOARD_EVENT_KEYCODE,
                            );

                            // Handle backspace (key code 51)
                            if key_code == 51 {
                                if let Ok(mut m) = matcher.lock() {
                                    m.on_backspace();
                                }
                                return Some(event.clone());
                            }

                            // Try to get character from event
                            if let Some(ch) = key_code_to_char(key_code as u16) {
                                if let Ok(mut m) = matcher.lock() {
                                    if let Some(expansion) = m.on_char(ch) {
                                        // Clear buffer so synthetic events don't cause false matches
                                        m.clear();

                                        let trigger_len =
                                            m.get_trigger_len(&expansion).unwrap_or(0);
                                        drop(m);

                                        perform_expansion(&app, &expansion, trigger_len);
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                    Some(event.clone())
                },
            );

            if let Ok(tap) = tap {
                let run_loop = CFRunLoop::get_current();
                if let Ok(source) = tap.mach_port.create_runloop_source(0) {
                    unsafe {
                        run_loop.add_source(&source, kCFRunLoopDefaultMode);
                    }
                    CFRunLoop::run_current();
                }
            }
        });
    }

    pub fn set_prefix(&self, prefix: String) {
        if let Ok(mut matcher) = self.matcher.lock() {
            matcher.set_prefix(prefix);
        }
    }

    pub fn set_expansions(&self, expansions: HashMap<String, String>) {
        if let Ok(mut matcher) = self.matcher.lock() {
            matcher.set_expansions(expansions);
        }
    }

    pub fn set_enabled(&self, enabled: bool) {
        if let Ok(mut is_enabled) = self.enabled.lock() {
            *is_enabled = enabled;
        }
    }
}

#[cfg(target_os = "macos")]
fn key_code_to_char(key_code: u16) -> Option<char> {
    // Simple mapping for common keys
    match key_code {
        0 => Some('a'),
        1 => Some('s'),
        2 => Some('d'),
        3 => Some('f'),
        4 => Some('h'),
        5 => Some('g'),
        6 => Some('z'),
        7 => Some('x'),
        8 => Some('c'),
        9 => Some('v'),
        11 => Some('b'),
        12 => Some('q'),
        13 => Some('w'),
        14 => Some('e'),
        15 => Some('r'),
        16 => Some('y'),
        17 => Some('t'),
        18 => Some('1'),
        19 => Some('2'),
        20 => Some('3'),
        21 => Some('4'),
        22 => Some('6'),
        23 => Some('5'),
        24 => Some('='),
        25 => Some('9'),
        26 => Some('7'),
        27 => Some('-'),
        28 => Some('8'),
        29 => Some('0'),
        30 => Some(']'),
        31 => Some('o'),
        32 => Some('u'),
        33 => Some('['),
        34 => Some('i'),
        35 => Some('p'),
        36 => Some('\n'),
        37 => Some('l'),
        38 => Some('j'),
        39 => Some('\''),
        40 => Some('k'),
        41 => Some(';'),
        42 => Some('\\'),
        43 => Some(','),
        44 => Some('/'),
        45 => Some('n'),
        46 => Some('m'),
        47 => Some('.'),
        50 => Some('`'),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn perform_expansion<R: Runtime>(_app: &AppHandle<R>, content: &str, backspace_count: usize) {
    use std::io::Write;
    use std::process::{Command, Stdio};
    use std::thread;
    use std::time::Duration;

    let content = content.to_string();

    thread::spawn(move || {
        // Brief delay to let the suppressed key event fully resolve
        thread::sleep(Duration::from_millis(20));

        // Write expansion text to clipboard via pbcopy (handles all chars / Unicode safely)
        if let Ok(mut pbcopy) = Command::new("pbcopy").stdin(Stdio::piped()).spawn() {
            if let Some(stdin) = pbcopy.stdin.as_mut() {
                let _ = stdin.write_all(content.as_bytes());
            }
            let _ = pbcopy.wait();
        }

        // Single osascript: delete trigger chars then paste — much faster than two calls + keystroke
        let script = if backspace_count > 0 {
            format!(
                r#"tell application "System Events"
    repeat {n} times
        key code 51
    end repeat
    delay 0.02
    keystroke "v" using command down
end tell"#,
                n = backspace_count
            )
        } else {
            r#"tell application "System Events" to keystroke "v" using command down"#.to_string()
        };

        let _ = Command::new("osascript").args(["-e", &script]).output();
    });
}
