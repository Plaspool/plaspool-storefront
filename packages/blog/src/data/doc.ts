import type { DocNode } from "./types";

/** Flattens a document to plain text — for meta descriptions and excerpts. */
export function docToText(doc: DocNode | null | undefined): string {
  if (!doc) return "";
  const out: string[] = [];
  const walk = (n: DocNode) => {
    if (n.text) out.push(n.text);
    for (const child of n.content ?? []) walk(child);
  };
  walk(doc);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function truncate(text: string, limit = 180): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}
