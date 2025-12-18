import type { Intent } from "./types";

export function normalizeTopicKey(primaryKeyword: string, intent: Intent, locale: string) {
  const base = `${primaryKeyword}__${intent}__${locale}`.toLowerCase().trim();
  return base
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
