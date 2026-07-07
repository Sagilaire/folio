import { test, expect } from "@playwright/test";

test.describe("FOLIO public site", () => {
  test("landing renders hero + CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FOLIO/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Write once",
    );
    await expect(
      page.getByRole("link", { name: /Read articles/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Abrir el editor/i }),
    ).toBeVisible();
  });

  test("articles list page is empty or shows posts", async ({ page }) => {
    await page.goto("/posts");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /articles/i,
    );
  });

  test("admin redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login\?return=/);
    await expect(
      page.getByRole("heading", { name: /Sign in to write/i }),
    ).toBeVisible();
  });

  test("login form has email + password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await page.getByRole("button", { name: /Create an account/i }).click();
    await expect(page.locator("#password")).toBeVisible();
  });
});
