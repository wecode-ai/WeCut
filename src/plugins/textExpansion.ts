import { invoke } from "@tauri-apps/api/core";

export async function setTextExpansionPrefix(prefix: string): Promise<void> {
  await invoke("set_text_expansion_prefix", { prefix });
}

export async function setTextExpansions(
  expansions: Record<string, string>,
): Promise<void> {
  await invoke("set_text_expansions", { expansions });
}

export async function setTextExpansionEnabled(enabled: boolean): Promise<void> {
  await invoke("set_text_expansion_enabled", { enabled });
}
