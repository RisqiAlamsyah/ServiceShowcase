import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Next menyisipkan elemen role="alert" sendiri (route announcer), jadi batasi ke <p> galat form.
const formError = (page: Page) => page.locator('p[role="alert"]');

// Alur penuh daftar → masuk → keluar. Butuh DATABASE_URL + AUTH_SECRET sungguhan (database DEV),
// sehingga dilewati di CI. Jalankan lokal: E2E_WITH_DB=1 npm run test:e2e -- auth-flow
// Setiap proyek (desktop/mobile) membuat satu akun uji unik di database dev (email @example.test).
test.skip(!process.env.E2E_WITH_DB, "butuh database dev (set E2E_WITH_DB=1)");
test.describe.configure({ mode: "serial" });

// Tiap run memakai IP acak (header x-real-ip yang dibaca pembatas laju) supaya tidak berbagi bucket
// dengan run sebelumnya. Di Vercel header ini diisi platform, bukan klien.
const randomByte = () => 1 + Math.floor(Math.random() * 254);
test.use({
  extraHTTPHeaders: { "x-real-ip": `10.${randomByte()}.${randomByte()}.${randomByte()}` },
});

test("daftar, gagal masuk generik, masuk, sesi bertahan, lalu keluar", async ({ page }, info) => {
  const email = `e2e-${info.project.name}-${randomUUID()}@example.test`;
  const secretValue = `sandi-${randomUUID()}`;

  // Daftar → diarahkan ke /masuk dengan pesan netral.
  await page.goto("/daftar");
  await page.getByLabel("Nama").fill("Penguji E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Sandi", { exact: true }).fill(secretValue);
  await page.getByLabel("Ulangi sandi").fill(secretValue);
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page).toHaveURL(/\/masuk\?daftar=1/);
  await expect(page.getByRole("status")).toContainText("Pendaftaran diproses");

  // Sandi salah → pesan generik, tetap di /masuk.
  // Tiap percobaan dimulai dari halaman segar: React me-reset form setelah action selesai dan pesan
  // galat lama tetap tampil, sehingga tanpa ini isian bisa terhapus di tengah pengisian.
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Sandi").fill(`${secretValue}-salah`);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(formError(page)).toContainText("Email atau sandi salah");
  await expect(page).toHaveURL(/\/masuk/);

  // Email tak terdaftar → pesan yang sama persis.
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(`tidak-ada-${randomUUID()}@example.test`);
  await page.getByLabel("Sandi").fill(secretValue);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(formError(page)).toContainText("Email atau sandi salah");

  // Sandi benar → /dashboard.
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Sandi").fill(secretValue);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Penguji E2E");

  // Cookie sesi httpOnly dan tidak terbaca skrip.
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.includes("authjs.session-token"));
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");

  // Sesi bertahan setelah muat ulang; halaman auth mengarahkan ke dashboard.
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/masuk");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Keluar → akses /dashboard ditolak lagi.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/masuk\?next=/);
});
