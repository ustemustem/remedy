import { readFileSync } from "node:fs";

/**
 * Parse a .env file's CONTENTS (not a path) into key/value pairs. Pure, so the
 * runner's env handling is unit-testable without touching the filesystem.
 * Deliberately tiny — handles KEY=VALUE, comments, blank lines, '=' in values,
 * and one layer of surrounding quotes. Not a full dotenv (no interpolation).
 */
export function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key === "") continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Load `.env.local` into process.env for the standalone eval process (Next
 * isn't running, so its automatic env loading doesn't apply). Only sets keys
 * that aren't already present, so an ambient env wins. Silent no-op if the file
 * is missing — the runner then surfaces a clear "key not set" error on first call.
 */
export function loadEnvLocal(path = ".env.local"): void {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const [k, v] of Object.entries(parseEnv(contents))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
