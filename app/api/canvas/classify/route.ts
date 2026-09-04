import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { classifyNoteReal } from "@/lib/llm/notes";

/**
 * POST /api/canvas/classify — the real classifyNote seam. Cheap Haiku call
 * returning whether a note refines the card in place or branches a new
 * direction. Kept separate so the client can branch its own orchestration
 * before fetching the content.
 */

export const runtime = "nodejs";

const RequestSchema = z.object({
  note: z.string().trim().min(1).max(2000),
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
    return Response.json({ error: "Invalid input." }, { status: 400 });
  }
  const { note, locale = "en" } = parsed.data;

  try {
    const intent = await withTelemetry("classifyNote", MODELS.cheap, async () => {
      const { intent, usage } = await classifyNoteReal(note, locale);
      return { result: intent, usage };
    });
    return Response.json({ intent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
