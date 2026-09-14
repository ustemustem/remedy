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
