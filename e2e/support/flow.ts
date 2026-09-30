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

/** The end-of-path card's "View report" (inside the canvas), not the header's. */
export function endCardViewReport(page: Page) {
  // A real <button>: React Flow gives the card wrapper role="button" too, and
  // its accessible name includes the same text.
  return page.locator(".react-flow button", { hasText: /view report/i });
}

/** Full journey to the report: submit, then keep accepting the newest
 *  proposal ("Prefer this option", which also marks it selected) until the
 *  path reaches its end card, and open the report from there. The header's
 *  "View report" stays off until a first report exists. Resolves once the
 *  report heading is visible. */
export async function reachReport(page: Page, vent = SAMPLE_VENT) {
  await submitVent(page, vent);
  for (let i = 0; i < 8; i++) {
    if (await endCardViewReport(page).isVisible()) break;
    await page.getByRole("button", { name: /prefer this option/i }).last().click();
    await endCardViewReport(page)
      .waitFor({ timeout: 4000 })
      .catch(() => {});
  }
  await endCardViewReport(page).click();
  // level 1 = the report title <h1>; a Section 02 <h2> "Your prescription" also
  // exists, so disambiguate by heading level.
  await expect(page.getByRole("heading", { level: 1, name: /your prescription/i })).toBeVisible();
}
