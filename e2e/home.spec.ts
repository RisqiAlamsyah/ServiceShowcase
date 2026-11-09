import { expect, test } from "@playwright/test";

test.describe("beranda", () => {
  test("menampilkan judul dan tema", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Portofolio dan estimasi harga",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  });

  test("skrip dan gaya berjalan tanpa pelanggaran CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/content security policy/i.test(msg.text())) violations.push(msg.text());
    });
    page.on("pageerror", (err) => violations.push(err.message));

    await page.goto("/", { waitUntil: "networkidle" });
    // Skrip Next harus benar-benar dieksekusi (nonce diterapkan), bukan hanya HTML server.
    const scripts = await page.locator("script[nonce]").count();
    expect(scripts).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  test("melayani header keamanan dan CSP ber-nonce, tanpa X-Powered-By", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();

    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["permissions-policy"]).toContain("camera=()");

    const csp = h["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  });

  test("nonce berbeda pada setiap permintaan", async ({ request }) => {
    const nonce = async () =>
      ((await request.get("/")).headers()["content-security-policy"] ?? "").match(
        /'nonce-([^']+)'/,
      )?.[1];
    const [a, b] = [await nonce(), await nonce()];
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  test("rute yang tidak ada mengembalikan 404 tanpa detail internal", async ({ request }) => {
    const res = await request.get("/tidak-ada-halaman-ini");
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toMatch(/stack|node_modules|at .*\.tsx?:\d+/i);
  });
});
