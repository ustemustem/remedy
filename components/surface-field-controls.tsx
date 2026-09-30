"use client";

// Live tuning for the canvas's Surface Field background (Experiments panel).
// State lives in page.tsx and flows to CanvasScreen -> SurfaceFieldBackground,
// so every change shows on the canvas at once. "Copy config" gives the tuned
// values as JSX props, ready to bake into SURFACE_FIELD_DEFAULTS.

import { useCallback, useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SliderRow } from "@/components/paper-texture-controls";
import {
  SURFACE_FIELD_DEFAULTS,
  type SurfaceFieldSettings,
} from "@/components/canvas/surface-field-background";

const PRESS = "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]";

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        {hint && <span className="block text-[10px] leading-snug text-muted-foreground/80">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          value ? "bg-cta" : "bg-border"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-200",
            value && "translate-x-3"
          )}
        />
      </button>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function configJsx(s: SurfaceFieldSettings): string {
  return [
    "<SurfaceField",
    `  gap={${s.gap}}`,
    `  focusRadius={${s.focusRadius}}`,
    `  lineRadius={${s.lineRadius}}`,
    `  connected={${s.connected}}`,
    `  baseOpacity={${s.baseOpacity}}`,
    `  maxOpacity={${s.maxOpacity}}`,
    `  surfacePadding={${s.surfacePadding}}`,
    `  cursorPush={${s.cursorPush}}`,
    `  ripplePush={${s.ripplePush}}`,
    `  breathe={${s.breathe}}`,
    `  wander={${s.wander}}`,
    "/>",
    `// Remedy: arrivalRipple=${s.arrivalRipple}`,
  ].join("\n");
}

/** The controls, presentational: state is owned by the caller. */
export function SurfaceFieldControls({
  value,
  onChange,
  active,
}: {
  value: SurfaceFieldSettings;
  onChange: (s: SurfaceFieldSettings) => void;
  /** False while the canvas shows plain dots: the controls still work, with a hint. */
  active: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<SurfaceFieldSettings>) => onChange({ ...value, ...patch });

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(configJsx(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked: no-op */
    }
  }, [value]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Surface field</p>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {active
              ? "Tune the canvas field live. Open a canvas to see changes."
              : "Switch Canvas background to Surface field to see these."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(SURFACE_FIELD_DEFAULTS)}
          title="Reset to defaults"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:text-foreground",
            PRESS
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <Group title="Dots">
        <SliderRow label="Spacing" value={value.gap} min={8} max={40} step={1} unit="px" onChange={(v) => set({ gap: v })} />
        <SliderRow
          label="Resting opacity"
          value={value.baseOpacity}
          min={0}
          max={0.3}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => set({ baseOpacity: v })}
        />
        <SliderRow
          label="Opacity under the light"
          value={value.maxOpacity}
          min={0.05}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => set({ maxOpacity: v })}
        />
        <SliderRow
          label="Breathing dots"
          value={value.breathe}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => set({ breathe: v })}
        />
      </Group>

      <Group title="Light & lines">
        <SliderRow
          label="Light radius"
          value={value.focusRadius}
          min={100}
          max={1200}
          step={10}
          unit="px"
          onChange={(v) => set({ focusRadius: v })}
        />
        <ToggleRow label="Connected lines" value={value.connected} onChange={(v) => set({ connected: v })} />
        <SliderRow
          label="Line reach"
          value={value.lineRadius}
          min={40}
          max={600}
          step={10}
          unit="px"
          onChange={(v) => set({ lineRadius: v })}
        />
        <ToggleRow
          label="Wandering light"
          hint="The light drifts when the pointer is away."
          value={value.wander}
          onChange={(v) => set({ wander: v })}
        />
      </Group>

      <Group title="Around cards">
        <SliderRow
          label="Clearing around cards"
          value={value.surfacePadding}
          min={-16}
          max={64}
          step={1}
          unit="px"
          onChange={(v) => set({ surfacePadding: v })}
        />
      </Group>

      <Group title="Interaction">
        <ToggleRow
          label="Ring when a card arrives"
          hint="One ring from a new card's centre. Never for cards already on screen."
          value={value.arrivalRipple}
          onChange={(v) => set({ arrivalRipple: v })}
        />
        <SliderRow
          label="Pointer distortion"
          value={value.cursorPush}
          min={0}
          max={12}
          step={0.5}
          unit="px"
          onChange={(v) => set({ cursorPush: v })}
        />
        <SliderRow
          label="Click ripple push"
          value={value.ripplePush}
          min={0}
          max={24}
          step={1}
          unit="px"
          onChange={(v) => set({ ripplePush: v })}
        />
      </Group>

      <button
        type="button"
        onClick={copy}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-background py-1.5 text-[11px] font-medium text-foreground hover:border-foreground/30",
          PRESS
        )}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-primary" />
            Copied config
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy config
          </>
        )}
      </button>
    </div>
  );
}
