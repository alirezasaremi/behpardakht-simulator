import { expect, test } from "@playwright/test";

test("shows simulator identity and credential warning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toHaveText("Unofficial Behpardakht Payment Gateway Simulator");
  await expect(page.getByText("No real payment occurs.")).toBeVisible();
  await expect(page.getByText(/Never enter real card/i)).toBeVisible();
});
