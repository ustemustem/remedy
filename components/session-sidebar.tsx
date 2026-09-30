"use client";

import { useRef, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SessionSearchOverlay } from "@/components/session-search-overlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionLabel, type SessionRecord } from "@/lib/sessions";
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
  onRename,
  onPin,
}: {
  sessions: SessionRecord[];
  activeId: string | null;
  onSelect: (session: SessionRecord) => void;
  onNewSession: () => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pinned = sessions
    .filter((s) => s.pinnedAt)
    .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
  const recents = sessions.filter((s) => !s.pinnedAt);

  const renderItem = (session: SessionRecord) =>
    session.id === editingId ? (
      <RenameField
        key={session.id}
        initial={sessionLabel(session)}
        onDone={(title) => {
          if (title !== null) onRename(session.id, title);
          setEditingId(null);
        }}
      />
    ) : (
      <div
        key={session.id}
        className={cn(
          "group relative rounded-[var(--radius-card)] border border-transparent transition-colors hover:border-border",
          session.id === activeId && "bg-muted"
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(session)}
          onDoubleClick={() => setEditingId(session.id)}
          className="w-full space-y-0.5 p-2 pr-8 text-left text-xs whitespace-nowrap"
        >
          <p className="line-clamp-2 font-medium whitespace-normal text-foreground">
            {sessionLabel(session)}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{STEP_LABEL[session.step]}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(session.updatedAt)}</span>
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Session options"
              className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="right"
            className="w-36"
            // Keep focus off the trigger on close, so Rename's field keeps it.
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem onSelect={() => setEditingId(session.id)}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPin(session.id, !session.pinnedAt)}>
              {session.pinnedAt ? <PinOff /> : <Pin />}
              {session.pinnedAt ? "Unpin" : "Pin"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );

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
        {pinned.length > 0 && <SectionLabel>Pinned</SectionLabel>}
        {pinned.map(renderItem)}
        {recents.length > 0 && <SectionLabel>Recents</SectionLabel>}
        {recents.map(renderItem)}
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

/** Enter or blur saves, Escape cancels. onDone(null) means cancel. */
function RenameField({ initial, onDone }: { initial: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(initial);
  // Escape unmounts the field, and some browsers then fire blur too; finish once.
  const finished = useRef(false);
  const finish = (title: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(title);
  };
  return (
    <input
      autoFocus
      aria-label="Session name"
      value={value}
      maxLength={80}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") finish(null);
      }}
      className="w-full rounded-[var(--radius-card)] border border-ring bg-background p-2 text-xs font-medium text-foreground outline-none"
    />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-1.5 pt-2 pb-0.5 font-mono text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-muted-foreground first:pt-0">
      {children}
    </p>
  );
}
