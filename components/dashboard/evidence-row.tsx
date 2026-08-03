"use client";

import type { EvidenceExample } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<EvidenceExample["kind"], string> = {
  linkedin: "LinkedIn",
  app: "App",
  company: "Company",
};

export function EvidenceRow({ examples }: { examples: EvidenceExample[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-3">
      {examples.map((example) => (
        <div key={example.kind} className="space-y-1">
          <Badge variant="outline">{KIND_LABEL[example.kind]}</Badge>
          <p className="text-[length:var(--text-label)] font-medium text-foreground">
            {example.label}
          </p>
          <p className="text-[length:var(--text-label)] text-muted-foreground">
            {example.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
