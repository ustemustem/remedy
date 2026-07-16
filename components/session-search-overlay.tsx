"use client";

import { useMemo, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { INDUSTRIES, type Industry } from "@/lib/examplePrompts";
import type { SessionRecord } from "@/lib/sessions";

const DATE_FILTERS = ["Today", "This week", "This month", "All"] as const;
type DateFilter = (typeof DATE_FILTERS)[number];

function matchesDateFilter(updatedAt: number, filter: DateFilter): boolean {
  if (filter === "All") return true;
  const diffMs = Date.now() - updatedAt;
  const day = 86_400_000;
  if (filter === "Today") return diffMs < day;
  if (filter === "This week") return diffMs < day * 7;
  return diffMs < day * 30; // This month
}

export function SessionSearchOverlay({
  open,
  onOpenChange,
  sessions,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: SessionRecord[];
  onSelect: (session: SessionRecord) => void;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("All");
  const [industryFilter, setIndustryFilter] = useState<Industry | "all">("all");

  const filtered = useMemo(
    () =>
      sessions
        .filter((s) => matchesDateFilter(s.updatedAt, dateFilter))
        .filter((s) => industryFilter === "all" || s.industry === industryFilter),
    [sessions, dateFilter, industryFilter]
  );

  function handleSelect(session: SessionRecord) {
    onSelect(session);
    onOpenChange(false);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search sessions"
      description="Search and filter your past sessions"
    >
      <Command>
        <CommandInput placeholder="Search sessions…" />
        <CommandList>
          <CommandEmpty>No sessions found.</CommandEmpty>

          <CommandGroup heading="Date">
            {DATE_FILTERS.map((f) => (
              <CommandItem
                key={f}
                value={`date ${f}`}
                data-checked={dateFilter === f}
                onSelect={() => setDateFilter(f)}
              >
                {f}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Context">
            <CommandItem
              value="context all"
              data-checked={industryFilter === "all"}
              onSelect={() => setIndustryFilter("all")}
            >
              All
            </CommandItem>
            {INDUSTRIES.map((option) => (
              <CommandItem
                key={option.id}
                value={`context ${option.label}`}
                data-checked={industryFilter === option.id}
                onSelect={() => setIndustryFilter(option.id)}
              >
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Recent">
            {filtered.map((session) => (
              <CommandItem
                key={session.id}
                value={`${session.chatText || "untitled"} ${session.id}`}
                onSelect={() => handleSelect(session)}
              >
                {session.chatText || "Untitled session"}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
