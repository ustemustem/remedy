import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readOptionResponse } from "@/lib/llm/option-response";

/**
 * POST /api/canvas/option — the real getOptionResponse content seam. Given the
 * card the user was working from and the option they picked, returns the next
 * recommendation (+ optional constructive counter-argument). Content only; the
 * client assembles the graph nodes around it.
 */

export const runtime = "nodejs";

const RequestSchema = z.object({
  parentTitle: z.string().trim().min(1).max(400),
  parentBody: z.string().trim().min(1).max(4000),
  option: z
    .object({
      title: z.string().trim().min(1).max(200),
      subtitle: z.string().trim().max(600),
    })
    .nullable()
    .optional(),
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
  const { parentTitle, parentBody, option = null, liked = [], disliked = [], locale = "en" } =
    parsed.data;

  try {
    const response = await withTelemetry("getOptionResponse", MODELS.reasoning, async () => {
      const { response, usage } = await readOptionResponse(
        { parentTitle, parentBody, option, liked, disliked },
        locale
      );
      return { result: response, usage };
    });
    return Response.json({
      recommendation: response.recommendation,
      counterArgument: response.counterArgument,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
