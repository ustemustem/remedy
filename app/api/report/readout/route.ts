import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readSessionReadout } from "@/lib/llm/report";

/**
 * POST /api/report/readout — the real content seam for report Section 2
 * ("How we read your situation"). Returns the model's raw segments; the client
 * coerces them and falls back to a template on error.
 */

export const runtime = "nodejs";

const StatsSchema = z.object({
  likeCount: z.number().int().min(0),
  dislikeCount: z.number().int().min(0),
  selectedCount: z.number().int().min(0),
  pathCount: z.number().int().min(0),
  optionPickCount: z.number().int().min(0),
  ownFramingCount: z.number().int().min(0),
  noteCount: z.number().int().min(0),
});

const RequestSchema = z.object({
  stats: StatsSchema,
  themes: z
    .array(z.object({ theme: z.string().trim().max(120), type: z.enum(["like", "dislike"]) }))
    .max(40),
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
  const { stats, themes, locale = "en" } = parsed.data;

  try {
    const segments = await withTelemetry("sessionReadout", MODELS.cheap, async () => {
      const { result, usage } = await readSessionReadout({ stats, themes }, locale);
      return { result, usage };
    });
    return Response.json({ segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
