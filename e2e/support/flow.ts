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
  // Finalizing with a single path and no feedback pops a confirmation dialog;
  // accept it if it appears (and tolerate its absence if the rule changes).
  await page
    .getByRole("button", { name: /finalize anyway/i })
    .click({ timeout: 5000 })
    .catch(() => {});
  // level 1 = the report title <h1>; a Section 02 <h2> "Your prescription" also
  // exists, so disambiguate by heading level.
  await expect(page.getByRole("heading", { level: 1, name: /your prescription/i })).toBeVisible();
}
