import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readFitSignals } from "@/lib/llm/report";

/**
 * POST /api/report/fit — Phase 3a fit signal. Returns raw fit parts per
 * recommendation (no composite); the client computes the composite and falls
 * back to omission on error.
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
    const fits = await withTelemetry("fitSignal", MODELS.reasoning, async () => {
      const { result, usage } = await readFitSignals({ vent, needs }, locale);
      return { result, usage };
    });
    return Response.json({ fits });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
