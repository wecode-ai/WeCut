import { isMac } from "@/utils/is";

export interface ParsedShortcut {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Parse a shortcut string into a normalized structure
 * Supports: "alt.enter", "cmd+shift+k", "ctrl+enter", "space", "delete"
 */
export function parseShortcut(shortcut: string): ParsedShortcut | null {
  if (!shortcut || shortcut.trim() === "") return null;

  const parts = shortcut.toLowerCase().split(/[.+]/).filter(Boolean);

  const result: ParsedShortcut = {
    altKey: false,
    ctrlKey: false,
    key: "",
    metaKey: false,
    shiftKey: false,
  };

  for (const part of parts) {
    const trimmed = part.trim();

    switch (trimmed) {
      case "alt":
        result.altKey = true;
        break;
      case "ctrl":
      case "control":
        result.ctrlKey = true;
        break;
      case "cmd":
      case "command":
      case "meta":
        result.metaKey = true;
        break;
      case "shift":
        result.shiftKey = true;
        break;
      default:
        // This is the main key
        result.key = normalizeKey(trimmed);
        break;
    }
  }

  // If no main key found, invalid shortcut
  if (!result.key) return null;

  return result;
}

/**
 * Normalize key names for consistent comparison
 */
function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    arrowdown: "arrowdown",
    arrowleft: "arrowleft",
    arrowright: "arrowright",
    arrowup: "arrowup",
    backspace: "backspace",
    bs: "backspace",
    del: "delete",
    delete: "delete",
    down: "arrowdown",
    end: "end",
    enter: "enter",
    esc: "escape",
    escape: "escape",
    home: "home",
    left: "arrowleft",
    pagedown: "pagedown",
    pageup: "pageup",
    return: "enter",
    right: "arrowright",
    space: " ",
    spacebar: " ",
    tab: "tab",
    up: "arrowup",
  };

  return keyMap[key] || key.toLowerCase();
}

/**
 * Check if a keyboard event matches a parsed shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ParsedShortcut,
): boolean {
  if (!shortcut) return false;

  const eventKey = event.key.toLowerCase();
  const normalizedEventKey = normalizeKey(eventKey);

  // Check main key
  if (normalizedEventKey !== shortcut.key) return false;

  // Check modifiers
  if (event.altKey !== shortcut.altKey) return false;
  if (event.ctrlKey !== shortcut.ctrlKey) return false;
  if (event.metaKey !== shortcut.metaKey) return false;
  if (event.shiftKey !== shortcut.shiftKey) return false;

  return true;
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: string): string {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return "";

  const parts: string[] = [];

  if (parsed.metaKey) parts.push(isMac ? "⌘" : "Win");
  if (parsed.ctrlKey) parts.push(isMac ? "⌃" : "Ctrl");
  if (parsed.altKey) parts.push(isMac ? "⌥" : "Alt");
  if (parsed.shiftKey) parts.push(isMac ? "⇧" : "Shift");

  // Format main key
  const keyDisplay: Record<string, string> = {
    " ": "Space",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    arrowup: "↑",
    backspace: "⌫",
    delete: "Del",
    enter: "↵",
    escape: "Esc",
  };
  parts.push(keyDisplay[parsed.key] || parsed.key.toUpperCase());

  return parts.join(isMac ? "" : "+");
}

/**
 * Check if two shortcuts conflict (would trigger on the same key combo)
 */
export function shortcutsConflict(a: string, b: string): boolean {
  const parsedA = parseShortcut(a);
  const parsedB = parseShortcut(b);

  if (!parsedA || !parsedB) return false;

  return (
    parsedA.key === parsedB.key &&
    parsedA.altKey === parsedB.altKey &&
    parsedA.ctrlKey === parsedB.ctrlKey &&
    parsedA.metaKey === parsedB.metaKey &&
    parsedA.shiftKey === parsedB.shiftKey
  );
}
