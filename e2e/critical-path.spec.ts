import { test, expect } from "@playwright/test";
import { submitVent, reachReport } from "./support/flow";

test("chat entry screen loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
});

test("submitting a vent renders the canvas", async ({ page }) => {
  await submitVent(page);
  // Off until the first report is built at the end of a path.
  await expect(page.getByRole("button", { name: /view report/i })).toBeDisabled();
  await expect(page.getByText(/counter-argument/i).first()).toBeVisible();
});

test("finalizing renders the report with both text sections", async ({ page }) => {
  await reachReport(page);
  await expect(page.getByRole("heading", { name: /what we understood/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /how we read your situation/i })).toBeVisible();
  await expect(page.getByTestId("understood-summary")).toBeVisible();
  await expect(page.getByTestId("session-readout")).toBeVisible();
});

test("a saved report reopens from the header without the loader", async ({ page }) => {
  await reachReport(page);
  await page.getByRole("button", { name: /back to canvas/i }).click();
  const header = page.getByRole("banner").getByRole("button", { name: /view report/i });
  await expect(header).toBeEnabled();
  await header.click();
  // Straight to the report: no loader in between.
  await expect(page.getByRole("heading", { level: 1, name: /your prescription/i })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole("button", { name: /choose version/i })).toHaveText(/v1/);
});
