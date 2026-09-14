# E2E Critical-Path Suite (Playwright) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This session will execute it inline.

**Goal:** Add a small, focused Playwright E2E suite that drives the app's one critical journey — chat vent → canvas → Finalize → report — under `LLM_MOCK=1`, and locks in the Phase 3c report seams plus their template fallback as a regression shield.

**Architecture:** Playwright with a `webServer` that starts `npm run dev` with `LLM_MOCK=1` (deterministic, free — the whole real request path runs on fixtures). Tests use role/heading-text selectors plus two new `data-testid`s on the report paragraphs. A tiny helper module (`e2e/support/flow.ts`) encapsulates the shared "reach the report" flow (the skill's Page-Object idea, kept as functions for 3 tests). The fallback test uses `page.route` to force the report routes to 500 and asserts the report still renders.

**Tech Stack:** `@playwright/test` (Chromium), Next.js dev server, `LLM_MOCK=1`.

## Global Constraints

- E2E specs live in `e2e/` as `*.spec.ts`; vitest stays on `*.test.ts` (`evals/**`, `lib/**`) so the two runners never overlap.
- Deterministic + free: the dev server for E2E MUST run with `LLM_MOCK=1` (set in `webServer.env`, which Next treats as authoritative over `.env.local`). No real API key, no cost.
- Selectors: prefer `getByRole` / heading text / `getByTestId`. Never CSS-class or nth-child selectors.
- Bundle into the existing branch `claude/remaining-tasks-13dc05` → updates PR #19 (3c + E2E together).
- Commit only as part of this session's push to that branch (footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).
- Verify per task with the exact `npx playwright test ...` command shown; final task also re-runs `tsc` + `lint` + `vitest`.

## File Structure

- Create `playwright.config.ts` — runner + webServer config.
- Create `e2e/support/flow.ts` — shared flow helpers (`submitVent`, `reachReport`).
- Create `e2e/critical-path.spec.ts` — smoke (chat loads), canvas renders, report renders both sections.
- Create `e2e/report-fallback.spec.ts` — routes forced to 500, report still renders (template fallback).
- Modify `components/dashboard/understood-summary.tsx` — add `data-testid="understood-summary"` to the summary `<p>`.
- Modify `components/dashboard/session-summary-section.tsx` — add `data-testid="session-readout"` to the readout `<p>`.
- Modify `.gitignore` — ignore `playwright-report/` and `test-results/`.
- Modify `package.json` — add `@playwright/test` devDep (via install) + `"test:e2e": "playwright test"` script.

---

### Task 1: Playwright setup + smoke test

**Files:**
- Create: `playwright.config.ts`
- Modify: `.gitignore`
- Modify: `package.json` (devDep + script — via the install command)
- Create: `e2e/critical-path.spec.ts` (smoke test only for this task)

**Interfaces:**
- Produces: a runnable `npx playwright test`; `webServer` on `http://localhost:3000` with `LLM_MOCK=1`.

- [ ] **Step 1: Install Playwright + Chromium**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add the npm script** to `package.json` `scripts` (next to `"test"`):

```json
"test:e2e": "playwright test",
```

- [ ] **Step 3: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

// E2E runs the app under LLM_MOCK=1 so the whole real request path executes on
// deterministic fixtures — no API key, no cost. webServer.env is authoritative
// over .env.local (Next does not override real env vars with .env files).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { LLM_MOCK: "1" },
  },
});
```

- [ ] **Step 4: Ignore Playwright output** — append to `.gitignore`:

```
# playwright
/playwright-report/
/test-results/
```

- [ ] **Step 5: Write the smoke test** `e2e/critical-path.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test("chat entry screen loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
});
```

- [ ] **Step 6: Run the smoke test**

Run: `npx playwright test e2e/critical-path.spec.ts`
Expected: 1 passed. (Playwright starts/reuses the dev server on :3000.)

---

### Task 2: Report happy-path test + testids + flow helpers

**Files:**
- Modify: `components/dashboard/understood-summary.tsx`
- Modify: `components/dashboard/session-summary-section.tsx`
- Create: `e2e/support/flow.ts`
- Modify: `e2e/critical-path.spec.ts` (add canvas + report tests)

**Interfaces:**
- Consumes: the Task 1 config.
- Produces: `submitVent(page, vent?)`, `reachReport(page, vent?)` in `e2e/support/flow.ts`; `data-testid="understood-summary"` and `data-testid="session-readout"` on the report paragraphs.

- [ ] **Step 1: Add the summary testid.** In `components/dashboard/understood-summary.tsx`, on the results `<p>` (the one that maps `segments`, not the loading branch), change:

```tsx
    <p className="text-sm text-foreground">
```

to:

```tsx
    <p className="text-sm text-foreground" data-testid="understood-summary">
```

- [ ] **Step 2: Add the readout testid.** In `components/dashboard/session-summary-section.tsx`, on the loaded `<p>` (inside the `readout === null ? ... : (...)` branch), change:

```tsx
        <p className="text-sm leading-[1.55] text-foreground">
```

to:

```tsx
        <p className="text-sm leading-[1.55] text-foreground" data-testid="session-readout">
```

- [ ] **Step 3: Write the flow helpers** `e2e/support/flow.ts`

```ts
import { expect, type Page } from "@playwright/test";

export const SAMPLE_VENT =
  "We keep losing strong engineering candidates late in the hiring process. " +
  "Offers stall in approvals and feedback to candidates is slow.";

/** Chat entry -> submit a vent -> land on the canvas. */
export async function submitVent(page: Page, vent = SAMPLE_VENT) {
  await page.goto("/");
  await page.getByRole("textbox").first().fill(vent);
  await page.getByRole("button", { name: /send/i }).click();
}

/** Full journey to the report: submit, accept the counter-argument (an
 *  accept-and-continue that marks a node selected, so the report has a need),
 *  then Finalize. Resolves once the report heading is visible. */
export async function reachReport(page: Page, vent = SAMPLE_VENT) {
  await submitVent(page, vent);
  await page.getByRole("button", { name: /prefer this option/i }).first().click();
  await page.getByRole("button", { name: /finalize/i }).click();
  await expect(page.getByRole("heading", { name: /your prescription/i })).toBeVisible();
}
```

- [ ] **Step 4: Add the canvas + report tests** to `e2e/critical-path.spec.ts` (keep the smoke test; add the import and two tests):

```ts
import { test, expect } from "@playwright/test";
import { submitVent, reachReport } from "./support/flow";

test("chat entry screen loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
});

test("submitting a vent renders the canvas", async ({ page }) => {
  await submitVent(page);
  await expect(page.getByRole("button", { name: /finalize/i })).toBeVisible();
  await expect(page.getByText(/counter-argument/i).first()).toBeVisible();
});

test("finalizing renders the report with both text sections", async ({ page }) => {
  await reachReport(page);
  await expect(page.getByRole("heading", { name: /what we understood/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /how we read your situation/i })).toBeVisible();
  await expect(page.getByTestId("understood-summary")).toBeVisible();
  await expect(page.getByTestId("session-readout")).toBeVisible();
});
```

- [ ] **Step 5: Run the critical-path suite**

Run: `npx playwright test e2e/critical-path.spec.ts`
Expected: 3 passed.

---

### Task 3: Report fallback test

**Files:**
- Create: `e2e/report-fallback.spec.ts`

**Interfaces:**
- Consumes: `reachReport` from `e2e/support/flow.ts`; the two `data-testid`s.

- [ ] **Step 1: Write the fallback test** `e2e/report-fallback.spec.ts`

```ts
import { test, expect } from "@playwright/test";
import { reachReport } from "./support/flow";

test("report renders via template fallback when the seams return 500", async ({ page }) => {
  let summaryHits = 0;
  let readoutHits = 0;

  await page.route("**/api/report/summary", async (route) => {
    summaryHits += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "forced test error" }),
    });
  });
  await page.route("**/api/report/readout", async (route) => {
    readoutHits += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "forced test error" }),
    });
  });

  await reachReport(page);

  // Both sections still render despite the 500s — the client falls back to the
  // deterministic templates. The summary template always opens "You came in with".
  await expect(page.getByTestId("understood-summary")).toBeVisible();
  await expect(page.getByTestId("session-readout")).toBeVisible();
  await expect(page.getByText(/you came in with/i)).toBeVisible();

  // Prove the routes were actually intercepted and failed (not silently skipped).
  expect(summaryHits).toBeGreaterThan(0);
  expect(readoutHits).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the fallback test**

Run: `npx playwright test e2e/report-fallback.spec.ts`
Expected: 1 passed.

---

### Task 4: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole E2E suite**

Run: `npx playwright test`
Expected: 5 passed (smoke + canvas + report + fallback = 4... confirm count: 3 in critical-path + 1 fallback = 4 passed).

- [ ] **Step 2: Confirm nothing else regressed**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: `tsc` clean, `lint` clean, vitest 28 passed. (If lint flags the `e2e/` files, fix the specific rule violation in the test file — do not disable the rule globally.)

---

## Self-Review

**Spec coverage:** Playwright chosen ✓ (Task 1 config). Focused critical path — happy path chat→canvas→Finalize→report (Task 2), both report sections (Task 2), fallback via route-500 (Task 3) ✓. Config + npm script, no GH Action ✓ (Task 1; no workflow file created). `LLM_MOCK=1` deterministic/free ✓ (webServer.env). Bundle into PR #19 ✓ (same branch; push in the execution wrap-up).

**Placeholder scan:** none — every step has real config/test code.

**Type consistency:** `submitVent`/`reachReport` defined in Task 2 (`e2e/support/flow.ts`), imported unchanged in Task 2's spec and Task 3's spec. `data-testid` values `understood-summary` / `session-readout` set in Task 2 components and referenced verbatim by `getByTestId` in Tasks 2–3. Task 4 Step 1 count corrected to **4 passed** (3 in `critical-path.spec.ts` + 1 in `report-fallback.spec.ts`).

**Note:** the smoke test's `getByRole("textbox").first()` targets the chat vent textarea; if the app later mounts another textbox on `/`, tighten to `getByPlaceholder(/start typing/i)`.
