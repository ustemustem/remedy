"use client";

import { ChartStatFlow } from "@/components/charts/chart-stat-flow";
import { Card, CardContent } from "@/components/ui/card";

export function KpiStatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col items-start px-[var(--card-px)]">
        <ChartStatFlow
          value={value}
          label={label}
          valueClassName="font-mono text-2xl font-bold text-foreground"
          labelClassName="text-[length:var(--text-label)] text-muted-foreground"
        />
      </CardContent>
    </Card>
  );
}
