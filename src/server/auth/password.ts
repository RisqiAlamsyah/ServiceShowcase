import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm: 2) dengan parameter minimum rekomendasi OWASP: m=19 MiB, t=2, p=1.
const OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    // Hash rusak/tidak dikenal diperlakukan sebagai gagal, bukan error yang membocorkan detail.
    return false;
  }
}

// Hash tiruan: dipakai agar waktu respons login tetap mirip saat email tidak terdaftar
// (anti-enumerasi, RULES_SECURITY §2.8).
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword("sandi-tiruan-yang-tidak-pernah-dipakai");
  await verifyPassword(await dummyHash, plain);
  return false;
}
