import OpenAI from "openai";
import { z } from "zod/v4";
import type { Usage } from "./telemetry";

// Server-only guard (security checklist A: hide API keys). This module reads
// the API key and must never end up in a client bundle. If it is ever imported
// into client code it throws loudly at module load instead of silently shipping
// key-reading code to the browser.
if (typeof window !== "undefined") {
  throw new Error(
    "lib/llm/client must only be imported from server code (route handlers, server components)."
  );
}

/**
 * The LLM is Google Gemini, reached through its OpenAI-compatible endpoint so we
 * can use the standard OpenAI SDK. The key is a FREE Google AI Studio key, read
 * from the environment (`.env.local`) — never hardcoded, never sent to the
 * client. Gemini's free tier means the whole app runs at zero cost.
 */
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey " +
        "and add it to .env.local (GEMINI_API_KEY=...), then restart the dev server."
    );
  }
  return key;
}

let cached: OpenAI | null = null;

/** Lazily-constructed singleton so the key is only read when a real call runs. */
function getClient(): OpenAI {
  if (cached === null) {
    cached = new OpenAI({ apiKey: requireApiKey(), baseURL: GEMINI_BASE_URL });
  }
  return cached;
}

/**
 * Mock mode. When on, the seams return canned fixtures instead of calling the
 * API, so the ENTIRE real request path — route handlers, zod validation,
 * telemetry, graph assembly, client render — runs end to end with no key and no
 * cost. Explicit `LLM_MOCK=1`/`0` wins; otherwise we default to mock whenever
 * there's no key present, so the app never makes a real call (or throws for a
 * missing key) by accident. Read at call time so toggling only needs a restart.
 */
export function isLlmMock(): boolean {
  const v = process.env.LLM_MOCK?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  const key = process.env.GEMINI_API_KEY;
  return !key || key.trim() === "";
}

/**
 * Model tiers. `reasoning` carries graph generation, summaries, and the fit
 * signal; `cheap` handles the one-enum / one-sentence seams. Both default to
 * Gemini 2.5 Flash (fast, free tier, strong at structured output) and are
 * overridable via env so you can point a seam at a different Gemini model
 * without touching code.
 */
export const MODELS = {
  reasoning: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
  cheap: process.env.GEMINI_MODEL_CHEAP?.trim() || "gemini-3.8-flash",
};

function mapUsage(
  u: { prompt_tokens?: number | null; completion_tokens?: number | null } | null | undefined
): Usage {
  if (!u) return {};
  return { input_tokens: u.prompt_tokens ?? null, output_tokens: u.completion_tokens ?? null };
}

function stripFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1].trim() : t;
}

/**
 * The single seam every real LLM call goes through: system + user in, a
 * Zod-schema-validated object out. Uses Gemini's OpenAI-compatible endpoint with
 * JSON-schema structured output, then re-validates with the same Zod schema so a
 * malformed response throws here rather than flowing downstream. Callers pass
 * the exact same schemas they always used; only the transport changed.
 */
export async function parseStructured<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName?: string;
  maxTokens?: number;
}): Promise<{ result: T; usage: Usage }> {
  const client = getClient();
  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  // Drop the JSON Schema dialect metadata: it's unnecessary here and some
  // providers reject the unknown top-level `$schema` key.
  delete jsonSchema.$schema;
  const completion = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schemaName ?? "output", schema: jsonSchema },
    },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Model returned no content.");
  return { result: opts.schema.parse(JSON.parse(stripFences(content))), usage: mapUsage(completion.usage) };
}
