import { expect, test, type Page } from "@playwright/test";
import { registerAndLogin, setPlan } from "./helpers/session";

// Alur penuh paket + add-on + batas tier. Butuh DATABASE_URL + AUTH_SECRET sungguhan (database
// DEV), sehingga dilewati di CI. Jalankan lokal: E2E_WITH_DB=1 npx playwright test package-flow
// Membuat akun uji (email @example.test), paket, dan add-on di database dev. Tier akun uji diubah
// langsung di DB dev oleh helper setPlan (tidak ada jalur UI untuk upgrade).
test.skip(!process.env.E2E_WITH_DB, "butuh database dev (set E2E_WITH_DB=1)");
test.describe.configure({ mode: "serial" });

async function addPackage(page: Page, title: string, price: string) {
  await page.getByLabel("Nama paket").fill(title);
  await page.getByLabel("Harga dasar (Rp)").fill(price);
  await page.getByRole("button", { name: "Tambah paket" }).click();
  await expect(page.getByRole("status")).toContainText("Paket ditambahkan.");
}

test("paket, add-on, batas tier Free/Pro, sembunyikan saat turun, dan IDOR", async ({
  browser,
}, info) => {
  const a = await registerAndLogin(browser, `a-${info.project.name}`);
  const b = await registerAndLogin(browser, `b-${info.project.name}`);

  try {
    const page = a.page;

    // Awal: kosong. Validasi harga per kolom, isian bertahan, fokus ke galat.
    await page.goto("/dashboard/paket");
    await expect(page.getByText("Belum ada paket")).toBeVisible();
    await page.getByLabel("Nama paket").fill("Paket Akad");
    await page.getByLabel("Harga dasar (Rp)").fill("gratis");
    await page.getByRole("button", { name: "Tambah paket" }).click();
    await expect(page.getByText("Harga tidak valid.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Nama paket")).toHaveValue("Paket Akad");
    await expect(page.getByLabel("Harga dasar (Rp)")).toBeFocused();

    // Free: dua paket boleh, lalu form hilang dan batas tampil.
    await addPackage(page, "Paket Akad", "2.500.000");
    await expect(page.getByText("Rp 2.500.000")).toBeVisible();
    await addPackage(page, "Paket Resepsi", "Rp 4.000.000");
    await expect(page.getByText("Batas 2 paket tercapai.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tambah paket" })).toHaveCount(0);

    // Halaman paket: Free tidak punya add-on; ubah nama paket.
    await page.getByRole("link", { name: "Kelola paket Paket Akad" }).click();
    await expect(page.getByText("Add-on tersedia di paket Pro.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tambah add-on" })).toHaveCount(0);
    await page.getByLabel("Nama paket").fill("Paket Akad Premium");
    await page.getByRole("button", { name: "Simpan paket" }).click();
    await expect(page.getByRole("status")).toContainText("Paket disimpan.");
    const packageUrl = page.url();

    // Naik ke Pro (di DB dev): add-on dan paket ke-3 diizinkan.
    await setPlan(a.email, "PRO");
    await page.reload();
    await page.locator("#addon-new-name").fill("Hairdo tambahan");
    await page.locator("#addon-new-price").fill("150.000");
    await page.getByRole("button", { name: "Tambah add-on" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Add-on ditambahkan." })).toBeVisible();
    const addonItem = page.locator("li").filter({ hasText: "Hairdo tambahan" });
    await expect(addonItem).toContainText("Rp 150.000");

    await addonItem.getByLabel("Harga (Rp)").fill("175000");
    await addonItem.getByRole("button", { name: "Simpan add-on" }).click();
    await expect(addonItem.getByRole("status")).toContainText("Add-on disimpan.");
    await page.reload();
    await expect(page.locator("li").filter({ hasText: "Hairdo tambahan" })).toContainText(
      "Rp 175.000",
    );

    await page.goto("/dashboard/paket");
    await addPackage(page, "Paket Wisuda", "1.000.000");
    await expect(page.getByText("disembunyikan", { exact: false })).toHaveCount(0);

    // Turun ke Free: paket ke-3 disembunyikan (tidak dihapus), tidak bisa menambah.
    await setPlan(a.email, "FREE");
    await page.reload();
    await expect(page.getByRole("note")).toContainText("1 paket disembunyikan");
    await expect(page.locator("li").filter({ hasText: "Paket Wisuda" })).toContainText(
      "Disembunyikan",
    );
    await expect(page.locator("li").filter({ hasText: "Paket Akad Premium" })).toContainText(
      "Tampil di halaman publik",
    );
    await expect(page.getByRole("button", { name: "Tambah paket" })).toHaveCount(0);
    await page.goto(packageUrl);
    await expect(page.getByText("Add-on yang sudah ada tersimpan", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Hairdo tambahan/ })).toBeVisible(); // tidak dihapus

    // Hapus add-on: dua langkah, batal dulu tidak menghapus.
    await page.getByRole("button", { name: "Hapus add-on Hairdo tambahan" }).click();
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(page.getByRole("heading", { name: /Hairdo tambahan/ })).toBeVisible();
    await page.getByRole("button", { name: "Hapus add-on Hairdo tambahan" }).click();
    await page.getByRole("button", { name: "Ya, hapus" }).click();
    await expect(page.getByText("Belum ada add-on.")).toBeVisible();

    // IDOR: pengguna B tidak bisa membuka paket milik A (404) dan tidak melihatnya di daftar.
    const res = await b.page.goto(packageUrl);
    expect(res?.status()).toBe(404);
    await b.page.goto("/dashboard/paket");
    await expect(b.page.getByText("Paket Akad Premium")).toHaveCount(0);
    await expect(b.page.getByText("Belum ada paket")).toBeVisible();

    // Hapus paket: dua langkah lalu kembali ke daftar; slot terbuka lagi.
    await page.goto("/dashboard/paket");
    await page.getByRole("link", { name: "Kelola paket Paket Wisuda" }).click();
    await page.getByRole("button", { name: "Hapus paket" }).click();
    await page.getByRole("button", { name: "Ya, hapus" }).click();
    await expect(page).toHaveURL(/\/dashboard\/paket$/);
    await expect(page.getByText("Paket Wisuda")).toHaveCount(0);
    await expect(page.getByRole("note")).toHaveCount(0);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
