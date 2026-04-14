use std::collections::HashMap;

/// Text matcher for detecting trigger words and expanding them
/// This is a placeholder implementation for the text expansion feature
#[allow(dead_code)]
pub struct TextMatcher {
    prefix: String,
    expansions: HashMap<String, String>,
    buffer: String,
}

#[allow(dead_code)]
impl TextMatcher {
    pub fn new(prefix: String) -> Self {
        Self {
            prefix,
            expansions: HashMap::new(),
            buffer: String::with_capacity(100),
        }
    }

    pub fn set_expansions(&mut self, expansions: HashMap<String, String>) {
        self.expansions = expansions;
    }

    pub fn set_prefix(&mut self, prefix: String) {
        self.prefix = prefix;
    }

    pub fn on_char(&mut self, ch: char) -> Option<String> {
        self.buffer.push(ch);
        if self.buffer.len() > 100 {
            self.buffer.remove(0);
        }
        self.check_match()
    }

    pub fn on_backspace(&mut self) {
        self.buffer.pop();
    }

    pub fn clear(&mut self) {
        self.buffer.clear();
    }

    fn check_match(&self) -> Option<String> {
        for (trigger, content) in &self.expansions {
            let full_trigger = format!("{}{}", self.prefix, trigger);
            if let Some(pos) = self.buffer.rfind(&full_trigger) {
                // Check if this is a complete match (not a prefix of a longer trigger)
                let end_pos = pos + full_trigger.len();
                if end_pos == self.buffer.len() {
                    // This is a complete match at the end of buffer
                    return Some(content.clone());
                }
            }
        }
        None
    }

    pub fn get_trigger_len(&self, expansion: &str) -> Option<usize> {
        for (trigger, content) in &self.expansions {
            if content == expansion {
                let full_trigger = format!("{}{}", self.prefix, trigger);
                return Some(full_trigger.len());
            }
        }
        None
    }
}
