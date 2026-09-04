import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readPreferredContinuation } from "@/lib/llm/continuation";

/**
 * POST /api/canvas/prefer — the real getPreferredContinuation content seam.
 * Given the card the user chose to continue, returns the single next step.
 * Content only; the client assembles the node (preserving the card's kind).
 */

export const runtime = "nodejs";

const RequestSchema = z.object({
  title: z.string().trim().min(1).max(400),
  body: z.string().trim().min(1).max(4000),
  kind: z.string().trim().min(1).max(40),
  liked: z.array(z.string().max(120)).max(20).optional(),
  disliked: z.array(z.string().max(120)).max(20).optional(),
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
  const { title, body, kind, liked = [], disliked = [], locale = "en" } = parsed.data;

  try {
    const continuation = await withTelemetry(
      "getPreferredContinuation",
      MODELS.reasoning,
      async () => {
        const { continuation, usage } = await readPreferredContinuation(
          { title, body, kind, liked, disliked },
          locale
        );
        return { result: continuation, usage };
      }
    );
    return Response.json({ continuation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
