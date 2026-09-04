import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODELS, WEB_SEARCH_TOOL_TYPE } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { ProofSchema } from "@/lib/llm/schemas";

/**
 * Phase 0 proof route. Two things it verifies end to end, with real API
 * calls (each a fraction of a cent):
 *   1. Structured output — the model fills a schema, parsed via messages.parse().
 *   2. web_search — a real, cited URL comes back (the grounding engine, §03).
 *
 * POST it once the key is in .env.local. It is deliberately gated behind POST
 * (never cached, never auto-run) and is a throwaway to be deleted after the
 * real seams land. NOT wired to any UI.
 */

// The SDK needs the Node runtime (not edge).
export const runtime = "nodejs";

/** Pull cited URLs out of web_search_tool_result blocks, defensively — the
 *  exact result-block shape is version-specific, so we check at runtime. */
function extractCitations(content: Anthropic.ContentBlock[]): string[] {
  const urls: string[] = [];
  for (const block of content) {
    const b = block as unknown as { type: string; content?: unknown };
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) {
        const rr = r as { url?: string };
        if (typeof rr.url === "string") urls.push(rr.url);
      }
    }
  }
  return urls;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function POST() {
  const client = getClient();

  try {
    // 1) Structured-output proof
    const structured = await withTelemetry("proof:structured", MODELS.reasoning, async () => {
      const msg = await client.messages.parse({
        model: MODELS.reasoning,
        max_tokens: 256,
        output_config: { format: zodOutputFormat(ProofSchema) },
        messages: [
          { role: "user", content: "Greet a busy HR manager in one sentence, in English." },
        ],
      });
      return { result: msg.parsed_output, usage: msg.usage };
    });

    // 2) web_search proof — a real cited result
    const search = await withTelemetry("proof:web_search", MODELS.reasoning, async () => {
      const msg = await client.messages.create({
        model: MODELS.reasoning,
        max_tokens: 1024,
        tools: [{ type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: 2 }],
        messages: [
          {
            role: "user",
            content:
              "Name one well-regarded task-management app for a small team, and cite where you found it.",
          },
        ],
      });
      return {
        result: { text: extractText(msg.content), citations: extractCitations(msg.content) },
        usage: msg.usage,
      };
    });

    return Response.json({
      ok: true,
      structuredOutputWorks: structured != null,
      webSearchWorks: search.citations.length > 0,
      structured,
      search,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
