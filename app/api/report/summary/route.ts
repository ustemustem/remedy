import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readUnderstoodSummary } from "@/lib/llm/report";

/**
 * POST /api/report/summary — the real content seam for report Section 1
 * ("What we understood"). Returns the model's raw index-based segments; the
 * client maps refIndex back onto node ids and falls back to a template on error.
 */

export const runtime = "nodejs";

const RequestSchema = z.object({
  vent: z.string().trim().max(8000),
  needs: z
    .array(z.object({ label: z.string().trim().max(200), quote: z.string().trim().max(400) }))
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
    const segments = await withTelemetry("understoodSummary", MODELS.cheap, async () => {
      const { result, usage } = await readUnderstoodSummary({ vent, needs }, locale);
      return { result, usage };
    });
    return Response.json({ segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
