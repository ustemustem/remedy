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
