"use client";

import { ChartStatFlow } from "@/components/charts/chart-stat-flow";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiStatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card className={cn("py-4", className)}>
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
