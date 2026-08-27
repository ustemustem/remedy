"use client";

const RADIUS = 46;
const CIRCUMFERENCE = Math.PI * RADIUS;

export function MiniGauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 140 }}>
      <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden="true">
        <path
          d="M 14 58 A 46 46 0 0 1 106 58"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 14 58 A 46 46 0 0 1 106 58"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
        <text
          x="60"
          y="48"
          textAnchor="middle"
          fill="var(--color-foreground)"
          style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700 }}
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="sr-only">{Math.round(clamped)}% {label}</span>
      <span className="text-[length:var(--text-label)] text-muted-foreground">{label}</span>
    </div>
  );
}
