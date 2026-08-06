"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FeedbackStatCard({
  likeCount,
  dislikeCount,
  className,
}: {
  likeCount: number;
  dislikeCount: number;
  className?: string;
}) {
  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="flex flex-col items-start px-[var(--card-px)]">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-bold text-foreground">{likeCount}</span>
          <span className="text-[length:var(--text-label)] text-muted-foreground">liked</span>
          <span className="ml-2 font-mono text-2xl font-bold text-foreground">{dislikeCount}</span>
          <span className="text-[length:var(--text-label)] text-muted-foreground">disliked</span>
        </div>
        <span className="mt-0.5 text-[length:var(--text-label)] text-muted-foreground">
          Feedback
        </span>
      </CardContent>
    </Card>
  );
}
