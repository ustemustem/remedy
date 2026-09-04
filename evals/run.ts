/**
 * Eval runner for the getInitialCanvas seam (roadmap §04, Phase 1 leftover).
 * Calls the REAL server-side seam over the seed vents, applies the deterministic
 * checks, and prints a scored report. Run with: `npm run eval -- --limit 3`.
 *
 * Cost: one Sonnet 5 call per vent (≈ a cent or two). Use --limit while iterating.
 */
import { loadEnvLocal } from "./env";
import { SEED_VENTS } from "./seed-vents";
import { schemaValid } from "./checks";
import {
  checkInitialGraphStructure,
  checkAskVsGuess,
  checkRawHighlightsVerbatim,
} from "./initial-canvas-checks";
import { aggregate, formatReport, type VentResult } from "./score";
import { readInitialCanvas, assembleInitialGraph } from "../lib/llm/initial-canvas";
import { InitialReadingSchema } from "../lib/llm/schemas";
import type { Locale } from "../lib/llm/prompts";

interface Args {
  limit?: number;
  locale: Locale;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { locale: "en" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        console.error(
          `--limit must be a positive integer, got ${JSON.stringify(raw ?? "")} — refusing to run the full seed set by accident.`
        );
        process.exit(2);
      }
      args.limit = n;
    } else if (argv[i] === "--locale") {
      const v = argv[++i];
      if (v === "en" || v === "tr") args.locale = v;
    }
  }
  return args;
}

async function main() {
  // Must run before the first readInitialCanvas call. The client reads the key
  // lazily (getClient at call time), so loading env here — after imports — is
  // fine; the key is not touched at module load.
  loadEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const vents = args.limit ? SEED_VENTS.slice(0, args.limit) : SEED_VENTS;

  const results: VentResult[] = [];
  for (const vent of vents) {
    const start = Date.now();
    try {
      const { reading, usage } = await readInitialCanvas(vent.text, args.locale);
      const latencyMs = Date.now() - start;
      const graph = assembleInitialGraph(vent.text, reading);
      const checks = [
        schemaValid(InitialReadingSchema, reading),
        ...checkInitialGraphStructure(graph),
        checkRawHighlightsVerbatim(reading.highlights, vent.text),
        checkAskVsGuess(reading.inputQuality, vent.thin),
      ];
      results.push({
        id: vent.id,
        expectThin: vent.thin,
        inputQuality: reading.inputQuality,
        checks,
        latencyMs,
        usage,
      });
    } catch (err) {
      results.push({
        id: vent.id,
        expectThin: vent.thin,
        inputQuality: "error",
        checks: [],
        latencyMs: Date.now() - start,
        usage: {},
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const agg = aggregate(results);
  console.log(formatReport(agg, results));
  process.exit(agg.gates.structural && agg.gates.askVsGuess ? 0 : 1);
}

void main();
