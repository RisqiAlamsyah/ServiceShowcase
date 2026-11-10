import { defineConfig } from "prisma/config";

// Prisma CLI tidak membaca .env.local sendiri. Dibaca di sini (hanya dev lokal); di CI/Vercel
// variabel datang dari lingkungan. Berkas tidak ada = diabaikan.
try {
  process.loadEnvFile(".env.local");
} catch {
  // tidak ada .env.local
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Koneksi langsung (non-pooled) khusus migrasi. Kosong cukup untuk `prisma generate` di CI.
    url: process.env.DIRECT_URL ?? "",
  },
});
