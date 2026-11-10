import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Alur penuh profil + slug. Butuh DATABASE_URL + AUTH_SECRET sungguhan (database DEV), sehingga
// dilewati di CI. Jalankan lokal: E2E_WITH_DB=1 npx playwright test profile-flow
// Membuat akun uji unik (email @example.test) dan profil di database dev.
test.skip(!process.env.E2E_WITH_DB, "butuh database dev (set E2E_WITH_DB=1)");
test.describe.configure({ mode: "serial" });

const randomByte = () => 1 + Math.floor(Math.random() * 254);
const randomIp = () => `10.${randomByte()}.${randomByte()}.${randomByte()}`;
const formError = (page: Page) => page.locator('p[role="alert"]');

// Daftar lalu masuk, sampai tiba di /dashboard. IP acak agar tidak berbagi pembatas laju antar-run.
async function registerAndLogin(browser: Browser, label: string) {
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
  return { context, page };
}

async function fillProfile(
  page: Page,
  v: { name: string; wa: string; slug: string; bio?: string },
) {
  await page.getByLabel("Nama bisnis").fill(v.name);
  await page.getByLabel("Nomor WhatsApp").fill(v.wa);
  await page.getByLabel("Alamat halaman (slug)").fill(v.slug);
  await page.getByLabel(/Bio singkat/).fill(v.bio ?? "");
}

test("buat profil, validasi, ganti slug dengan konfirmasi, dan bentrok slug", async ({
  browser,
}, info) => {
  const slugA = `e2e-${info.project.name.slice(0, 1)}-${randomUUID().slice(0, 8)}`;
  const slugA2 = `${slugA}-baru`;
  const a = await registerAndLogin(browser, `a-${info.project.name}`);
  const b = await registerAndLogin(browser, `b-${info.project.name}`);

  try {
    // Dashboard menunjukkan profil belum dibuat.
    await expect(a.page.getByText("Profil belum dibuat")).toBeVisible();
    await a.page.getByRole("link", { name: "Lengkapi profil" }).click();
    await expect(a.page).toHaveURL(/\/dashboard\/profil$/);

    // Validasi server: galat per kolom, isian tetap ada, fokus ke galat pertama.
    await fillProfile(a.page, { name: "Dewi MUA", wa: "abc", slug: "admin" });
    await a.page.getByRole("button", { name: "Simpan profil" }).click();
    await expect(a.page.getByText("Nomor WhatsApp tidak valid.", { exact: false })).toBeVisible();
    await expect(a.page.getByText("Slug ini tidak tersedia. Pilih yang lain.")).toBeVisible();
    await expect(a.page.getByLabel("Nama bisnis")).toHaveValue("Dewi MUA");
    await expect(a.page.getByLabel("Nomor WhatsApp")).toBeFocused();

    // Berhasil: nomor dinormalkan, pesan sukses memuat alamat.
    await fillProfile(a.page, { name: "Dewi MUA", wa: "0812-3456-7890", slug: slugA, bio: "Halo" });
    await a.page.getByRole("button", { name: "Simpan profil" }).click();
    await expect(a.page.getByRole("status")).toContainText(slugA);
    await a.page.reload();
    await expect(a.page.getByLabel("Nomor WhatsApp")).toHaveValue("6281234567890");
    await expect(a.page.getByLabel("Alamat halaman (slug)")).toHaveValue(slugA);

    // Mengganti slug: kotak konfirmasi muncul, tanpa dicentang ditolak.
    await expect(a.page.getByRole("checkbox")).toHaveCount(0);
    await a.page.getByLabel("Alamat halaman (slug)").fill(slugA2);
    await expect(a.page.getByRole("checkbox")).toBeVisible();
    await a.page.getByRole("button", { name: "Simpan profil" }).click();
    await expect(
      a.page.getByText("Centang kotak ini untuk mengonfirmasi penggantian slug."),
    ).toBeVisible();

    // Dengan konfirmasi: berhasil.
    await a.page.getByRole("checkbox").check();
    await a.page.getByRole("button", { name: "Simpan profil" }).click();
    await expect(a.page.getByRole("status")).toContainText(slugA2);

    // Pengguna B tidak bisa memakai slug milik A (bentrok), dan profil A tidak terlihat oleh B.
    await b.page.goto("/dashboard/profil");
    await expect(b.page.getByLabel("Nama bisnis")).toHaveValue("");
    await fillProfile(b.page, { name: "Budi Foto", wa: "08123456780", slug: slugA2 });
    await b.page.getByRole("button", { name: "Simpan profil" }).click();
    await expect(b.page.getByText("Slug sudah dipakai. Pilih yang lain.")).toBeVisible();
    await expect(formError(b.page)).toHaveCount(0);

    // Slug lama A sudah dilepas: B boleh memakainya.
    await fillProfile(b.page, { name: "Budi Foto", wa: "08123456780", slug: slugA });
    await b.page.getByRole("button", { name: "Simpan profil" }).click();
    await expect(b.page.getByRole("status")).toContainText(slugA);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
