import { test, expect } from "@playwright/test";

test.describe("certificate login", () => {
  test("certificate login signs the user in", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in by certificate" }).click();

    await expect(page).toHaveURL(/\/automated-system/);
    expect(new URL(page.url()).hash).toBe("");

    await expect(page.getByText("99000001")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("invalid certificate shows an error on the callback", async ({ page }) => {
    await page.goto("/auth/cert/callback#error=cert_invalid");

    await expect(page.getByText(/Certificate sign-in failed/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to login" })).toBeVisible();
  });
});
