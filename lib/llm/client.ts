import Anthropic from "@anthropic-ai/sdk";

// Server-only guard (security checklist A: hide API keys). This module reads
// the API key and must never end up in a client bundle. If it is ever
// imported into client code it throws loudly at module load instead of
// silently shipping key-reading code to the browser. The stronger,
// build-time enforcement is the `server-only` package — add it as a Phase 1
// hardening (it wasn't installed yet).
if (typeof window !== "undefined") {
  throw new Error("lib/llm/client must only be imported from server code (route handlers, server components).");
}

/**
 * The Anthropic client, server-side only. The key is read from the
 * environment (`.env.local` at the project root) — never hardcoded, never
 * sent to the client. This module must only ever be imported from server
 * code (route handlers, server components), so the key stays on the server.
 *
 * See the backend roadmap §00·3 (no connector — we call the API from our own
 * server) and §Phase 0.
 */

function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local at the project root " +
        "(ANTHROPIC_API_KEY=sk-ant-...), then restart the dev server."
    );
  }
  return key;
}

let cached: Anthropic | null = null;

/** Lazily-constructed singleton so the key is only read when a call is made.
 *
 * Identity-linked API keys must say which workspace each request acts in. If
 * ANTHROPIC_WORKSPACE_ID is set we send it as the `anthropic-workspace-id`
 * header; a plain workspace-scoped key doesn't need it and can leave it unset. */
export function getClient(): Anthropic {
  if (cached === null) {
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    cached = new Anthropic({
      apiKey: requireApiKey(),
      ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
    });
  }
  return cached;
}

/**
 * Model tiers, per the roadmap §02. `reasoning` carries graph generation,
 * summaries, the fit signal, and grounded recommendations; `cheap` handles
 * the one-enum / one-sentence seams (classifyNote, readout). Escalate a
 * specific seam to a bigger model only when the eval set shows it plateauing
 * — measured, not assumed.
 */
export const MODELS = {
  reasoning: "claude-sonnet-5",
  cheap: "claude-haiku-4-5",
} as const;

/** The web search tool variant Sonnet 5 supports (verified against the
 *  installed SDK's tool-type union). Real, cited results, run server-side by
 *  Anthropic — this is the grounding engine (roadmap §03). */
export const WEB_SEARCH_TOOL_TYPE = "web_search_20260209" as const;
