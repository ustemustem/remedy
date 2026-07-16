"use client";

import { useState } from "react";
import { Plus, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SessionSearchOverlay } from "@/components/session-search-overlay";
import type { SessionRecord } from "@/lib/sessions";
import type { Step } from "@/lib/types";

const STEP_LABEL: Record<Step, string> = {
  chat: "Draft",
  canvas: "Canvas",
  dashboard: "Finalized",
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNewSession,
}: {
  sessions: SessionRecord[];
  activeId: string | null;
  onSelect: (session: SessionRecord) => void;
  onNewSession: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-300 ease-in-out",
        collapsed ? "w-12" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-3 py-2.5",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <p className="whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Sessions
          </p>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand session history" : "Collapse session history"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className={cn("flex gap-1.5 px-2 pt-2", collapsed && "flex-col items-center px-1.5")}>
        <Button
          variant="outline"
          size={collapsed ? "icon-sm" : "sm"}
          className={collapsed ? undefined : "flex-1"}
          onClick={onNewSession}
          aria-label="New session"
        >
          <Plus className="h-3.5 w-3.5" />
          {!collapsed && "New session"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSearchOpen(true)}
          aria-label="Search sessions"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        className={cn(
          "flex-1 space-y-1 overflow-y-auto px-2 py-2 transition-opacity duration-200",
          collapsed && "pointer-events-none overflow-hidden opacity-0"
        )}
      >
        {sessions.length === 0 && (
          <p className="whitespace-nowrap px-1.5 py-2 text-xs text-muted-foreground">
            Your past sessions will show up here.
          </p>
        )}
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session)}
            className={cn(
              "w-full space-y-0.5 rounded-xl border border-transparent p-2 text-left text-xs whitespace-nowrap transition-colors hover:border-border",
              session.id === activeId && "border-primary bg-primary/5"
            )}
          >
            <p className="line-clamp-2 font-medium whitespace-normal text-foreground">
              {session.chatText || "Untitled session"}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{STEP_LABEL[session.step]}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(session.updatedAt)}</span>
            </div>
          </button>
        ))}
      </div>

      <SessionSearchOverlay
        open={searchOpen}
        onOpenChange={setSearchOpen}
        sessions={sessions}
        onSelect={onSelect}
      />
    </div>
  );
}
