import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export type RateRule = { max: number; windowSeconds: number };

export const RATE_RULES = {
  loginEmail: { max: 5, windowSeconds: 15 * 60 },
  loginIp: { max: 20, windowSeconds: 15 * 60 },
  registerIp: { max: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateRule>;

// Kunci di-hash agar email/IP mentah tidak tersimpan di tabel (RULES_SECURITY §11.3).
export function bucketKey(scope: string, identity: string): string {
  const digest = createHash("sha256").update(identity.toLowerCase()).digest("hex");
  return `${scope}:${digest}`;
}

// Satu pernyataan atomik: aman dari balapan antar instance serverless. `true` = masih boleh.
export async function consume(scope: string, identity: string, rule: RateRule): Promise<boolean> {
  const key = bucketKey(scope, identity);
  const windowSeconds = rule.windowSeconds;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_buckets ("key", "count", "window_start")
    VALUES (${key}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN rate_limit_buckets."window_start" < CURRENT_TIMESTAMP - make_interval(secs => ${windowSeconds}::double precision)
        THEN 1 ELSE rate_limit_buckets."count" + 1 END,
      "window_start" = CASE
        WHEN rate_limit_buckets."window_start" < CURRENT_TIMESTAMP - make_interval(secs => ${windowSeconds}::double precision)
        THEN CURRENT_TIMESTAMP ELSE rate_limit_buckets."window_start" END
    RETURNING "count"`;
  const count = rows[0]?.count ?? Number.POSITIVE_INFINITY;
  // Pembersihan oportunistik baris kedaluwarsa (±1% permintaan) agar tabel tidak membengkak.
  if (Math.random() < 0.01) {
    await db.rateLimitBucket
      .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
      .catch(() => undefined);
  }
  return count <= rule.max;
}

// IP klien dari header yang diisi platform (Vercel). Di luar Vercel header ini bisa dipalsukan,
// tetapi tetap berguna sebagai kunci pembatas; bila tidak ada, jatuh ke bucket "unknown".
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers.get("x-real-ip")?.trim() || forwarded || "unknown";
}
