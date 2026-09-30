/**
 * Output-style safety net. The prompts already tell the model not to use em or
 * en dashes (see `writingStyleLines` in prompts.ts), but a model can still slip
 * one in. Every structured response passes through `sanitizeDashes` before
 * validation, so a stray dash never reaches the canvas or the report.
 */

/** Keys whose string values must stay byte-for-byte as the model returned them:
 *  `text` is a highlight that must match the user's own words exactly, and
 *  `url` is a citation that must match a real search result. */
const VERBATIM_KEYS = new Set(["text", "url"]);

/** Replace em and en dashes with plain punctuation. A dash used as a pause
 *  becomes a comma. An en dash inside a range ("2–3") becomes a hyphen. */
export function stripDashes(s: string): string {
  return s
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/–/g, "-")
    .replace(/,\s*([.,!?:])/g, "$1")
    .replace(/^,\s*/, "");
}

/** Walk a parsed JSON value and strip dashes from every string in it, except
 *  the values under `VERBATIM_KEYS`. */
export function sanitizeDashes(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    return key !== undefined && VERBATIM_KEYS.has(key) ? value : stripDashes(value);
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeDashes(v, key));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeDashes(v, k)])
    );
  }
  return value;
}
