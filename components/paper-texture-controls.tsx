"use client";

// Live tuning for the report sheet's "Vintage editorial paper" background — the
// Figma shader (owner ustemberkay, id e4a07d9e…) reproduced as static, scoped
// CSS (.report-sheet in globals.css). Every knob is a --report-paper-* custom
// property; this panel writes them onto document.documentElement so the change
// shows instantly on the report sheet, and offers Copy CSS to bake a tuned set
// back into globals.css.
//
// Two entry points:
//   • <PaperTextureControls value onChange /> — the presentational section,
//     embedded in the Experiments (flask) panel (experiment-overlay.tsx).
//   • <PaperTextureLab /> — a self-contained flask panel (owns state) for the
//     local /preview/report route, which doesn't mount ExperimentOverlay.
// State lives in usePaperTextureState(), called by whichever container is
// ALWAYS mounted (page.tsx's ExperimentOverlay, or the preview page), so tuning
// persists even while the flask panel is collapsed.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, FlaskConical, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaperTexture = {
  /** Sheet base color (hex). */
  base: string;
  /** Pinstripe color (hex) — converted to `r g b` channels for rgb(). */
  stripe: string;
  stripeOpacity: number;
  /** px */
  stripeWidth: number;
  /** px — center-to-center pinstripe spacing. */
  stripeSpace: number;
  /** deg */
  stripeAngle: number;
  /** 0–1 warm edge vignette (0 = off, the clinical default). */
  vignette: number;
  /** 0–1 grain strength (feTurbulence rect opacity). */
  grainOpacity: number;
  /** feTurbulence baseFrequency — higher = finer grain. */
  grainFreq: number;
};

/**
 * Matches the inline defaults in .report-sheet, so first mount is a no-op.
 * These are the values the user locked in from the Paper Texture Lab.
 */
export const PAPER_TEXTURE_DEFAULTS: PaperTexture = {
  base: "#f4f2eb",
  stripe: "#c8943e", // rgb(200 148 62)
  stripeOpacity: 0.12,
  stripeWidth: 0.7,
  stripeSpace: 5,
  stripeAngle: 55,
  vignette: 0.1,
  grainOpacity: 0.8,
  grainFreq: 1.5,
};

function hexToChannels(hex: string): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return "200 148 62";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function grainImage(freq: number, opacity: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>` +
    `<filter id='g'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/>` +
    `</filter>` +
    `<rect width='120' height='120' filter='url(#g)' opacity='${opacity}'/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Writes the texture onto :root as --report-paper-* custom properties. */
export function applyPaperTexture(t: PaperTexture) {
  const s = document.documentElement.style;
  s.setProperty("--report-paper-base", t.base);
  s.setProperty("--report-paper-stripe-color", hexToChannels(t.stripe));
  s.setProperty("--report-paper-stripe-opacity", String(t.stripeOpacity));
  s.setProperty("--report-paper-stripe-width", `${t.stripeWidth}px`);
  s.setProperty("--report-paper-stripe-space", `${t.stripeSpace}px`);
  s.setProperty("--report-paper-stripe-angle", `${t.stripeAngle}deg`);
  s.setProperty("--report-paper-vignette", String(t.vignette));
  s.setProperty("--report-paper-grain-image", grainImage(t.grainFreq, t.grainOpacity));
}

/** The tuned set as a paste-ready block for globals.css's .report-sheet. */
export function paperTextureCss(t: PaperTexture): string {
  return [
    "/* Paper texture — tuned in the Experiments panel */",
    `--report-paper-base: ${t.base};`,
    `--report-paper-stripe-color: ${hexToChannels(t.stripe)}; /* ${t.stripe} */`,
    `--report-paper-stripe-opacity: ${t.stripeOpacity};`,
    `--report-paper-stripe-width: ${t.stripeWidth}px;`,
    `--report-paper-stripe-space: ${t.stripeSpace}px;`,
    `--report-paper-stripe-angle: ${t.stripeAngle}deg;`,
    `--report-paper-vignette: ${t.vignette};`,
    `/* grain layer (regenerate --report-paper-grain-image): baseFrequency ${t.grainFreq}, opacity ${t.grainOpacity} */`,
  ].join("\n");
}

/** Owns texture state + keeps :root in sync. Call from an always-mounted host. */
export function usePaperTextureState() {
  const [tex, setTex] = useState<PaperTexture>(PAPER_TEXTURE_DEFAULTS);
  useEffect(() => {
    applyPaperTexture(tex);
  }, [tex]);
  return [tex, setTex] as const;
}

// Strong ease-out (easing.dev) — press feedback that feels intentional.
const PRESS = "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {(format ? format(value) : value) + unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cta"
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tabular-nums text-muted-foreground">
          {value}
        </span>
        <div className="relative h-5 w-8 overflow-hidden rounded-[var(--radius-control)] border border-border">
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>
    </div>
  );
}

/** The controls, presentational — state is owned by the caller. */
export function PaperTextureControls({
  value,
  onChange,
}: {
  value: PaperTexture;
  onChange: (t: PaperTexture) => void;
}) {
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<PaperTexture>) => onChange({ ...value, ...patch });

  const copyCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(paperTextureCss(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — no-op */
    }
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Paper texture</p>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Report sheet only — your &ldquo;Vintage editorial paper&rdquo; shader, live.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(PAPER_TEXTURE_DEFAULTS)}
          title="Reset to defaults"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:text-foreground",
            PRESS
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <ColorRow label="Paper color" value={value.base} onChange={(v) => set({ base: v })} />
      <ColorRow label="Stripe color" value={value.stripe} onChange={(v) => set({ stripe: v })} />

      <SliderRow
        label="Stripe opacity"
        value={value.stripeOpacity}
        min={0}
        max={0.4}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => set({ stripeOpacity: v })}
      />
      <SliderRow
        label="Stripe spacing"
        value={value.stripeSpace}
        min={4}
        max={40}
        step={1}
        unit="px"
        onChange={(v) => set({ stripeSpace: v })}
      />
      <SliderRow
        label="Stripe width"
        value={value.stripeWidth}
        min={0.4}
        max={4}
        step={0.1}
        unit="px"
        format={(v) => v.toFixed(1)}
        onChange={(v) => set({ stripeWidth: v })}
      />
      <SliderRow
        label="Stripe angle"
        value={value.stripeAngle}
        min={0}
        max={180}
        step={5}
        unit="°"
        onChange={(v) => set({ stripeAngle: v })}
      />
      <SliderRow
        label="Vignette"
        value={value.vignette}
        min={0}
        max={0.5}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => set({ vignette: v })}
      />
      <SliderRow
        label="Grain amount"
        value={value.grainOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(v) => set({ grainOpacity: v })}
      />
      <SliderRow
        label="Grain size"
        value={value.grainFreq}
        min={0.2}
        max={2.5}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(v) => set({ grainFreq: v })}
      />

      <button
        type="button"
        onClick={copyCss}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-background py-1.5 text-[11px] font-medium text-foreground hover:border-foreground/30",
          PRESS
        )}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-primary" />
            Copied CSS
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy CSS
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Self-contained flask panel for the local /preview/report route (which renders
 * DashboardScreen directly and never mounts ExperimentOverlay). Owns state via
 * usePaperTextureState, so tuning survives collapsing the panel.
 */
export function PaperTextureLab() {
  const [tex, setTex] = usePaperTextureState();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Paper texture"
        className={cn(
          "fixed right-4 top-16 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground",
          PRESS
        )}
      >
        <FlaskConical className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-16 z-50 flex max-h-[calc(100vh-5rem)] w-72 flex-col rounded-[var(--radius-surface)] border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border p-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Paper texture
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto p-3">
        <PaperTextureControls value={tex} onChange={setTex} />
      </div>
    </div>
  );
}
