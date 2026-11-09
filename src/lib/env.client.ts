import { parseClientEnv } from "@/lib/env.schema";

// NEXT_PUBLIC_* harus dirujuk secara statis agar Next.js menanamkannya ke bundel klien.
// Hanya nilai publik di sini; tidak pernah rahasia.
export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
