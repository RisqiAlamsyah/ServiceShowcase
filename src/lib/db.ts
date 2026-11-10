import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

// Singleton agar hot reload di dev tidak membuka koneksi berlipat (RULES_DB §3).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: serverEnv.DATABASE_URL }),
    // Log query bisa memuat data pribadi, jadi tidak diaktifkan di lingkungan mana pun.
    log: ["error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (serverEnv.NODE_ENV !== "production") globalForPrisma.prisma = db;
