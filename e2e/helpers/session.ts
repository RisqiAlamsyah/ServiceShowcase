import { randomUUID } from "node:crypto";
import { expect, type Browser } from "@playwright/test";
import { Client } from "pg";

// Helper untuk alur E2E yang butuh database DEV (E2E_WITH_DB=1). Jangan dipakai di CI.

const randomByte = () => 1 + Math.floor(Math.random() * 254);

// IP acak (header x-real-ip yang dibaca pembatas laju) agar tiap run tidak berbagi bucket.
export const randomIp = () => `10.${randomByte()}.${randomByte()}.${randomByte()}`;

// Daftar lalu masuk sampai tiba di /dashboard. Mengembalikan konteks browser, halaman, dan email.
export async function registerAndLogin(browser: Browser, label: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": randomIp() } });
  const page = await context.newPage();
  const email = `e2e-${label}-${randomUUID()}@example.test`;
  const secretValue = `sandi-${randomUUID()}`;

  await page.goto("/daftar");
  await page.getByLabel("Nama").fill(`Penguji ${label}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Sandi", { exact: true }).fill(secretValue);
  await page.getByLabel("Ulangi sandi").fill(secretValue);
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page).toHaveURL(/\/masuk\?daftar=1/);

  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Sandi").fill(secretValue);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page, email };
}

// Mengubah tier akun uji langsung di database dev (di aplikasi, `plan` tidak pernah dari input
// pengguna; perubahan sungguhan hanya oleh admin/billing). Hanya untuk email @example.test.
export async function setPlan(email: string, plan: "FREE" | "PRO") {
  if (!email.endsWith("@example.test")) throw new Error("setPlan hanya untuk akun uji");
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // variabel sudah ada di lingkungan
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query('UPDATE users SET plan = $1::"Plan" WHERE email = $2', [
      plan,
      email,
    ]);
    if (res.rowCount !== 1) throw new Error("akun uji tidak ditemukan");
  } finally {
    await client.end();
  }
}
