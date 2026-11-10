import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Alur penuh daftar → masuk → keluar. Butuh DATABASE_URL + AUTH_SECRET sungguhan (database DEV),
// sehingga dilewati di CI. Jalankan lokal: E2E_WITH_DB=1 npm run test:e2e -- auth-flow
// Setiap proyek (desktop/mobile) membuat satu akun uji unik; pembatas pendaftaran 5/jam per IP,
// jadi jangan menjalankan lebih dari beberapa kali per jam.
test.skip(!process.env.E2E_WITH_DB, "butuh database dev (set E2E_WITH_DB=1)");
test.describe.configure({ mode: "serial" });

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
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Sandi").fill(`${secretValue}-salah`);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert")).toContainText("Email atau sandi salah");
  await expect(page).toHaveURL(/\/masuk/);

  // Email tak terdaftar → pesan yang sama persis.
  await page.getByLabel("Email").fill(`tidak-ada-${randomUUID()}@example.test`);
  await page.getByLabel("Sandi").fill(secretValue);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert")).toContainText("Email atau sandi salah");

  // Sandi benar → /dashboard.
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
