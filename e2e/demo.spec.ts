import { expect, test, type Page } from "@playwright/test";

// Tanggal relatif terhadap hari ini (UTC tidak pernah lebih maju dari WIB, jadi -2 hari pasti lampau di WIB).
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const total = (page: Page) => page.getByTestId("total-amount");
const submit = (page: Page) => page.getByRole("button", { name: "Buat pratinjau pesan" });

test.describe("demo kalkulator: total real-time", () => {
  test("total mengikuti pilihan paket dan add-on, dan add-on direset saat paket berganti", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(total(page)).toHaveText("Rp 2.500.000");

    await page.getByRole("checkbox", { name: /Makeup Ibu Kandung/ }).check();
    await expect(total(page)).toHaveText("Rp 2.850.000");

    await page.getByRole("checkbox", { name: /Touch Up Resepsi/ }).check();
    await expect(total(page)).toHaveText("Rp 3.000.000");

    await page.getByRole("checkbox", { name: /Makeup Ibu Kandung/ }).uncheck();
    await expect(total(page)).toHaveText("Rp 2.650.000");

    await page.getByRole("radio", { name: /Paket Wisuda/ }).check();
    await expect(total(page)).toHaveText("Rp 450.000");
    await expect(page.getByRole("checkbox", { name: /Bulu Mata Premium/ })).not.toBeChecked();

    // Kembali ke paket pertama: add-on lama tidak ikut terpilih.
    await page.getByRole("radio", { name: /Paket Akad & Resepsi/ }).check();
    await expect(total(page)).toHaveText("Rp 2.500.000");
  });
});

test.describe("demo kalkulator: pratinjau pesan", () => {
  test("jalur berhasil: pesan sesuai format FRS 4.1 dan fokus pindah ke pratinjau", async ({
    page,
  }) => {
    const date = isoDaysFromNow(30);
    await page.goto("/demo");
    await page.getByRole("checkbox", { name: /Makeup Ibu Kandung/ }).check();
    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(date);
    await submit(page).click();

    const preview = page.getByTestId("wa-preview");
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("heading", { name: "Pratinjau pesan WhatsApp" })).toBeFocused();

    const text = await preview.locator("pre").innerText();
    expect(text.split("\n")).toEqual([
      "Halo kak!",
      "Saya mau booking jasa untuk:",
      "",
      "Nama: Siti Rahma",
      `Tanggal: ${ddmmyyyy(date)}`,
      "Paket: Paket Akad & Resepsi (Rp 2.500.000)",
      "Add-on:",
      "- Makeup Ibu Kandung (Rp 350.000)",
      "",
      "Total Estimasi: Rp 2.850.000",
      "",
      "Apakah slot tersedia?",
    ]);
  });

  test("pratinjau hilang saat pilihan berubah (tidak menampilkan data basi)", async ({ page }) => {
    await page.goto("/demo");
    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();
    await expect(page.getByTestId("wa-preview")).toBeVisible();

    await page.getByRole("checkbox", { name: /Touch Up Resepsi/ }).check();
    await expect(page.getByTestId("wa-preview")).toBeHidden();
  });

  test("jalur gagal: kolom kosong menampilkan galat, fokus ke kolom pertama, tanpa pratinjau", async ({
    page,
  }) => {
    await page.goto("/demo");
    await submit(page).click();

    await expect(page.getByTestId("wa-preview")).toBeHidden();
    await expect(page.getByLabel("Nama Anda")).toBeFocused();
    await expect(page.getByLabel("Nama Anda")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Nama minimal 2 karakter.")).toBeVisible();
    await expect(page.getByText("Pilih tanggal acara.")).toBeVisible();
  });

  test("jalur gagal: tanggal lampau ditolak", async ({ page }) => {
    await page.goto("/demo");
    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(-2));
    await submit(page).click();

    await expect(page.getByText("Tanggal acara tidak boleh sudah lewat.")).toBeVisible();
    await expect(page.getByLabel("Tanggal acara")).toBeFocused();
    await expect(page.getByTestId("wa-preview")).toBeHidden();
  });

  test("jalur gagal: nama berisi markup ditolak dan tidak pernah dirender sebagai HTML", async ({
    page,
  }) => {
    await page.goto("/demo");
    await page.getByLabel("Nama Anda").fill("<img src=x onerror=alert(1)>");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();

    await expect(page.getByText(/Nama hanya boleh huruf/)).toBeVisible();
    await expect(page.getByTestId("wa-preview")).toBeHidden();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("nama dengan spasi/baris berlebih dinormalkan di pesan", async ({ page }) => {
    await page.goto("/demo");
    await page.getByLabel("Nama Anda").fill("  Siti    Rahma  ");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();
    await expect(page.getByTestId("wa-preview").locator("pre")).toContainText("Nama: Siti Rahma\n");
  });
});

test.describe("demo kalkulator: tier dan parameter URL", () => {
  test("tier=free mengunci add-on dan total hanya harga paket", async ({ page }) => {
    await page.goto("/demo?tier=free");
    await expect(page.getByText(/Add-on tersedia di paket Pro/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Makeup Ibu Kandung/ })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: /Touch Up Resepsi/ })).toBeDisabled();
    await expect(total(page)).toHaveText("Rp 2.500.000");

    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();
    const text = await page.getByTestId("wa-preview").locator("pre").innerText();
    expect(text).not.toContain("Add-on:");
    expect(text).toContain("Total Estimasi: Rp 2.500.000");
  });

  test("tier=free: memaksa mengaktifkan checkbox lewat DevTools tidak membuka add-on", async ({
    page,
  }) => {
    await page.goto("/demo?tier=free");
    const addon = page.getByRole("checkbox", { name: /Makeup Ibu Kandung/ });
    await addon.evaluate((el) => el.removeAttribute("disabled"));
    await addon.click({ force: true });

    await expect(total(page)).toHaveText("Rp 2.500.000");
    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();
    const text = await page.getByTestId("wa-preview").locator("pre").innerText();
    expect(text).not.toContain("Makeup Ibu Kandung");
    expect(text).toContain("Total Estimasi: Rp 2.500.000");
  });

  for (const query of [
    "?tier=%3Cscript%3Ealert(1)%3C/script%3E",
    "?tier=admin",
    "?tier=free&tier=pro",
    "?tier[]=free",
    "?tier=",
    "?x=1&tier=PRO",
  ]) {
    test(`parameter tier tidak valid (${query}) jatuh ke Pro tanpa merusak halaman`, async ({
      page,
    }) => {
      const res = await page.goto(`/demo${query}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Studio Contoh MUA");
      await expect(page.getByRole("checkbox", { name: /Makeup Ibu Kandung/ })).toBeEnabled();
    });
  }
});

test.describe("demo kalkulator: keamanan dan tata letak", () => {
  test("berjalan tanpa pelanggaran CSP atau galat skrip", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (/content security policy/i.test(msg.text())) problems.push(msg.text());
    });
    page.on("pageerror", (err) => problems.push(err.message));

    await page.goto("/demo", { waitUntil: "networkidle" });
    await page.getByRole("checkbox", { name: /Makeup Ibu Kandung/ }).check();
    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();
    await expect(page.getByTestId("wa-preview")).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("mode demo tidak memanggil WhatsApp", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (req) => {
      if (/wa\.me|whatsapp\./i.test(req.url())) external.push(req.url());
    });
    page.on("popup", (p) => external.push(p.url()));

    await page.goto("/demo");
    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();
    await expect(page.getByTestId("wa-preview")).toBeVisible();

    expect(external).toEqual([]);
  });

  test("tidak ada scroll horizontal", async ({ page }) => {
    await page.goto("/demo");
    await page.getByLabel("Nama Anda").fill("Siti Rahma");
    await page.getByLabel("Tanggal acara").fill(isoDaysFromNow(10));
    await submit(page).click();
    await expect(page.getByTestId("wa-preview")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("beranda menautkan ke demo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Coba kalkulator estimasi" }).click();
    await expect(page).toHaveURL(/\/demo$/);
  });
});
