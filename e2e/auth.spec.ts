import { expect, test } from "@playwright/test";

// Skenario tanpa database: semua jalur di sini ditolak/ditangani sebelum menyentuh DB.

test.describe("halaman terproteksi", () => {
  test("/dashboard tanpa sesi diarahkan ke /masuk dengan parameter next", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/masuk\?next=%2Fdashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Masuk" })).toBeVisible();
  });

  test("sub-rute /dashboard juga dipagari", async ({ page }) => {
    await page.goto("/dashboard/apa-saja");
    await expect(page).toHaveURL(/\/masuk\?next=/);
  });

  test("endpoint sesi Auth.js tanpa login mengembalikan sesi kosong", async ({ request }) => {
    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

test.describe("/masuk", () => {
  test("form beraksesibilitas dan tanpa pelanggaran CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/content security policy/i.test(m.text())) violations.push(m.text());
    });
    await page.goto("/masuk", { waitUntil: "networkidle" });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Sandi")).toHaveAttribute("autocomplete", "current-password");
    await expect(page.getByRole("button", { name: "Masuk" })).toBeEnabled();
    expect(violations).toEqual([]);
  });

  test("header keamanan dan CSP ber-nonce ada pada halaman auth", async ({ request }) => {
    const h = (await request.get("/masuk")).headers();
    expect(h["content-security-policy"]).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("parameter next berbahaya diganti ke /dashboard (open redirect)", async ({ page }) => {
    await page.goto("/masuk?next=https%3A%2F%2Fjahat.example");
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
    await page.goto("/masuk?next=%2F%2Fjahat.example");
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
  });

  test("next relatif yang aman dipertahankan", async ({ page }) => {
    await page.goto("/masuk?next=%2Fdashboard%2Fpaket");
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard/paket");
  });

  test("email tidak valid menampilkan galat per kolom dan memindahkan fokus", async ({ page }) => {
    await page.goto("/masuk");
    await page.getByLabel("Email").fill("bukan-email");
    await page.getByLabel("Sandi").fill("apa-saja");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Email tidak valid.")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeFocused();
    await expect(page).toHaveURL(/\/masuk/);
  });
});

test.describe("/daftar", () => {
  test("input tidak valid menampilkan galat dan tidak berpindah halaman", async ({ page }) => {
    await page.goto("/daftar");
    await page.getByLabel("Nama").fill("Dewi Lestari");
    await page.getByLabel("Email").fill("dewi@example.com");
    await page.getByLabel("Sandi", { exact: true }).fill("pendek");
    await page.getByLabel("Ulangi sandi").fill("beda");
    await page.getByRole("button", { name: "Daftar" }).click();
    await expect(page.getByText(/Sandi minimal 12 karakter/).last()).toBeVisible();
    await expect(page.getByText("Konfirmasi sandi tidak sama.")).toBeVisible();
    await expect(page).toHaveURL(/\/daftar$/);
  });

  test("tautan silang antara masuk dan daftar berfungsi", async ({ page }) => {
    await page.goto("/daftar");
    await page.getByRole("link", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/masuk$/);
  });
});
