import { getUsageTotals } from "@/lib/llm/telemetry";
import { MODELS, isLlmMock } from "@/lib/llm/client";

/**
 * GET /api/usage — dev-facing token usage for this server process. Reports
 * tokens USED (from the per-call `usage` telemetry), never remaining quota:
 * Gemini's API doesn't expose remaining free-tier quota, and the free tier is a
 * single shared API key, not a per-user allowance. Read in the Experiments panel.
 */
export const runtime = "nodejs";

export async function GET() {
  const totals = getUsageTotals();
  return Response.json({
    calls: totals.calls,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    totalTokens: totals.inputTokens + totals.outputTokens,
    model: MODELS.reasoning,
    mock: isLlmMock(),
  });
}
