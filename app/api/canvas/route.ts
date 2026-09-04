import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readInitialCanvas, assembleInitialGraph } from "@/lib/llm/initial-canvas";

/**
 * POST /api/canvas — the real getInitialCanvas seam. Takes a vent, returns a
 * CanvasGraph (source + Suggestion + Counter-argument). The key never leaves
 * the server; the client only ever sees the graph.
 */

export const runtime = "nodejs";

// Validate all input server-side (security checklist D). Cap the length so an
// open text field can't be used to run up huge input-token bills.
const RequestSchema = z.object({
  chatText: z.string().trim().min(1, "chatText is required").max(5000),
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
  const { chatText, locale = "en" } = parsed.data;

  try {
    const reading = await withTelemetry("getInitialCanvas", MODELS.reasoning, async () => {
      const { reading, usage } = await readInitialCanvas(chatText, locale);
      return { result: reading, usage };
    });
    const graph = assembleInitialGraph(chatText, reading);
    // Trim the response to only what the client needs (security checklist D).
    return Response.json({ graph });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
