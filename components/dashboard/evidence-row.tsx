"use client";

import type { EvidenceExample } from "@/lib/types";

const KIND_HEADING: Record<EvidenceExample["kind"], string> = {
  app: "Tool",
  community: "Discussion",
  role: "Role search",
};

export function EvidenceRow({ examples }: { examples: EvidenceExample[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
      {examples.map((example) => (
        <div key={example.url} className="space-y-1">
          <p className="font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
            {KIND_HEADING[example.kind]}
          </p>
          <a
            href={example.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[length:var(--text-label)] text-muted-foreground underline decoration-1 decoration-primary/40 underline-offset-2 hover:text-foreground hover:decoration-primary"
          >
            {example.label} — {example.detail}
          </a>
        </div>
      ))}
    </div>
  );
}
