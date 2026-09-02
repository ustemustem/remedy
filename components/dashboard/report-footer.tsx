"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Report redesign's terminal action row (change C9) — the report's only
 * action row, no per-recommendation CTA on the cards above. No Save: with
 * no backend, a "Saved" confirmation would promise persistence that
 * doesn't exist. Export uses the browser's own print dialog (see
 * @media print in app/globals.css) rather than generating a .pdf directly
 * — the user saves one as a PDF from there if they want one. Share copies
 * the current URL; there's no real share/link backend yet.
 */
export function ReportFooter() {
  const [copied, setCopied] = useState(false);

  function handleExport() {
    window.print();
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can fail (permissions, insecure context). No real
      // fallback exists without a share backend — the button just stays
      // unconfirmed rather than throwing.
    }
  }

  return (
    <div className="report-print-hide mt-[22px] flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
      <p className="text-sm text-foreground">Your prescription is ready.</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Printer className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Share"}
        </Button>
      </div>
    </div>
  );
}
