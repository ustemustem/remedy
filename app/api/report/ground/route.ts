import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readGroundedEvidenceForOne } from "@/lib/llm/report";

/**
 * POST /api/report/ground — Phase 3b grounding. Grounds every recommendation in
 * parallel; each is a web_search + extraction. Returns evidence[] per need (same
 * order). The client omits evidence on error (no fabricated fallback).
 */
export const runtime = "nodejs";

const RequestSchema = z.object({
  vent: z.string().trim().max(8000),
  needs: z
    .array(z.object({ label: z.string().trim().max(200), body: z.string().trim().max(2000) }))
    .min(1)
    .max(12),
  locale: z.enum(["en", "tr"]).optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input.", detail: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const { vent, needs, locale = "en" } = parsed.data;

  try {
    const evidence = await Promise.all(
      needs.map((recommendation) =>
        withTelemetry("groundEvidence", MODELS.reasoning, async () => {
          const { result, usage } = await readGroundedEvidenceForOne({ vent, recommendation }, locale);
          return { result, usage };
        })
      )
    );
    return Response.json({ evidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
