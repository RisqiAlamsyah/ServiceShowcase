import { expect, test } from "@playwright/test";

// Tanpa database: pagar akses halaman paket.

test.describe("paket: akses ditolak", () => {
  test("/dashboard/paket tanpa sesi diarahkan ke /masuk dengan next", async ({ page }) => {
    await page.goto("/dashboard/paket");
    await expect(page).toHaveURL(/\/masuk\?next=%2Fdashboard%2Fpaket$/);
    await expect(page.getByRole("heading", { level: 1, name: "Masuk" })).toBeVisible();
  });

  test("/dashboard/paket/[id] tanpa sesi diarahkan ke /masuk", async ({ page }) => {
    await page.goto("/dashboard/paket/clh3am9gn0000a6lxg5c8k1zq");
    await expect(page).toHaveURL(/\/masuk\?next=/);
  });
});
