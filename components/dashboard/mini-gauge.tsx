"use client";

const RADIUS = 28;
const CIRCUMFERENCE = Math.PI * RADIUS;

export function MiniGauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 88 }}>
      <svg width="72" height="44" viewBox="0 0 72 44" aria-hidden="true">
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
        <text
          x="36"
          y="30"
          textAnchor="middle"
          fill="var(--color-foreground)"
          style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="sr-only">{Math.round(clamped)}% {label}</span>
      <span className="text-[length:var(--text-label)] text-muted-foreground">{label}</span>
    </div>
  );
}
