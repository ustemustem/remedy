import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readNoteContent, readRefinedOptions, type NoteContext } from "@/lib/llm/notes";
import type { NoteOp } from "@/lib/llm/prompts";

/**
 * POST /api/canvas/note — the real content seam for context notes. One route,
 * four operations (op): the three title+body ops (refine-plain, branch-plain,
 * branch-framing) and refine-options. Content only; the client assembles the
 * revision or new node around it.
 */

export const runtime = "nodejs";

const RequestSchema = z.object({
  op: z.enum(["refine-plain", "branch-plain", "branch-framing", "refine-options"]),
  parentTitle: z.string().trim().min(1).max(400),
  parentBody: z.string().trim().max(4000),
  kind: z.string().trim().min(1).max(40),
  note: z.string().trim().min(1).max(2000),
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
  const { op, parentTitle, parentBody, kind, note, liked = [], disliked = [], locale = "en" } =
    parsed.data;
  const ctx: NoteContext = { parentTitle, parentBody, kind, note, liked, disliked };

  try {
    if (op === "refine-options") {
      const options = await withTelemetry("refineChoiceOptions", MODELS.reasoning, async () => {
        const { options, usage } = await readRefinedOptions(ctx, locale);
        return { result: options, usage };
      });
      return Response.json({ options });
    }

    const seam =
      op === "refine-plain"
        ? "refinePlainCard"
        : op === "branch-plain"
          ? "branchFromNote"
          : "branchFromChoiceFraming";
    const content = await withTelemetry(seam, MODELS.reasoning, async () => {
      const { content, usage } = await readNoteContent(op as NoteOp, ctx, locale);
      return { result: content, usage };
    });
    return Response.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
