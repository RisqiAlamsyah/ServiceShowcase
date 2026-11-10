import { expect, test } from "@playwright/test";

// Tanpa database: pagar akses dan struktur halaman yang tidak membutuhkan sesi.

test.describe("profil: akses ditolak", () => {
  test("/dashboard/profil tanpa sesi diarahkan ke /masuk dengan next", async ({ page }) => {
    await page.goto("/dashboard/profil");
    await expect(page).toHaveURL(/\/masuk\?next=%2Fdashboard%2Fprofil$/);
    await expect(page.getByRole("heading", { level: 1, name: "Masuk" })).toBeVisible();
  });

  test("setelah login, next ke profil dipertahankan di form masuk", async ({ page }) => {
    await page.goto("/dashboard/profil");
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard/profil");
  });
});
