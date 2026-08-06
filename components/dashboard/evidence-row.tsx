"use client";

import type { EvidenceExample } from "@/lib/types";

const KIND_HEADING: Record<EvidenceExample["kind"], string> = {
  linkedin: "Our recommendation",
  app: "App suggestion",
  company: "Company match",
};

function narrativeFor(example: EvidenceExample): string {
  return `${example.label} — ${example.detail}`;
}

export function EvidenceRow({ examples }: { examples: EvidenceExample[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
      {examples.map((example) => (
        <div key={example.kind} className="space-y-1">
          <p className="font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
            {KIND_HEADING[example.kind]}
          </p>
          {example.kind === "linkedin" ? (
            <p className="border-l-2 border-border pl-2 text-[length:var(--text-label)] italic text-muted-foreground">
              &ldquo;{narrativeFor(example)}&rdquo;
            </p>
          ) : (
            <p className="text-[length:var(--text-label)] text-muted-foreground">
              {narrativeFor(example)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
