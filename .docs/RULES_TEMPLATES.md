# RULES_TEMPLATES.md — Template Kode ServiceShowcase

> Dibaca saat membuat Server Action, Route Handler, service, atau halaman. Aturan umum: `RULES.md`; keamanan: `RULES_SECURITY.md`.
> Contoh memakai domain fiktif `project`. Ikuti API versi Next.js/Auth.js/Prisma yang terpasang; sesuaikan bila berbeda (mis. `params`/`searchParams` berupa `Promise` sejak Next 15; `middleware` menjadi `proxy` di Next 16; versi proyek ini: Next 16).
> Urutan wajib di setiap titik masuk: **otentikasi → otorisasi → validasi → service → revalidasi → hasil seragam**.

---

## 1. Env tervalidasi — `src/lib/env.ts`

```ts
import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

export const serverEnv = serverSchema.parse(process.env);
// Variabel NEXT_PUBLIC_* tidak berisi rahasia; letakkan di berkas terpisah (src/lib/env.client.ts) tanpa "server-only".
```

---

## 2. Helper otorisasi — `src/server/auth/guards.ts`

```ts
import "server-only";
import { auth } from "@/auth";           // Auth.js v5; sesuaikan dengan versi terpasang
import type { Role } from "@prisma/client";

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") { super(code); }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("UNAUTHENTICATED");
  return session.user as { id: string; role: Role };
}

export function requireRole(user: { role: Role }, allowed: Role[]) {
  if (!allowed.includes(user.role)) throw new AuthError("FORBIDDEN");
}
```

---

## 3. Skema validasi — `src/lib/validation/project.ts`

```ts
import { z } from "zod";

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();                              // tolak field tak dikenal (cegah mass assignment)

export const projectIdSchema = z.object({ id: z.string().cuid() }).strict();
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
```

---

## 4. Service (satu-satunya tempat Prisma) — `src/server/project/service.ts`

```ts
import "server-only";
import { prisma } from "@/lib/db";
import type { CreateProjectInput } from "@/lib/validation/project";

// Otorisasi ikut di query: selalu sertakan ownerId.
export function getProjectForUser(userId: string, id: string) {
  return prisma.project.findFirst({
    where: { id, ownerId: userId },
    select: { id: true, title: true, description: true, createdAt: true }, // pilih kolom eksplisit
  });
}

export function listProjectsForUser(userId: string, cursor?: string, take = 20) {
  return prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 100),
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

export function createProject(userId: string, input: CreateProjectInput) {
  return prisma.project.create({ data: { ...input, ownerId: userId } }); // ownerId dari sesi, bukan input
}

export async function deleteProject(userId: string, id: string) {
  const { count } = await prisma.project.deleteMany({ where: { id, ownerId: userId } });
  return count === 1;
}
```

---

## 5. Server Action — `src/actions/project.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireUser } from "@/server/auth/guards";
import { createProject, deleteProject } from "@/server/project/service";
import { createProjectSchema, projectIdSchema } from "@/lib/validation/project";
import { limit } from "@/server/security/rate-limit";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/types/action";

export async function createProjectAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();                                   // 1. otentikasi (+ requireRole bila perlu)
    if (!(await limit("project:create", user.id))) {                    // 2. rate limit
      return { ok: false, code: "RATE_LIMITED", message: "Terlalu banyak permintaan. Coba lagi nanti." };
    }

    const parsed = createProjectSchema.safeParse(Object.fromEntries(formData)); // 3. validasi server
    if (!parsed.success) {
      return { ok: false, code: "VALIDATION", message: "Data tidak valid.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const project = await createProject(user.id, parsed.data);          // 4. service
    revalidatePath("/projects");                                        // 5. revalidasi tepat sasaran
    return { ok: true, data: { id: project.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, code: e.code, message: e.code === "UNAUTHENTICATED" ? "Silakan masuk." : "Tidak diizinkan." };
    }
    logger.error({ err: e, action: "createProject" });                  // detail hanya di log, tanpa data sensitif
    return { ok: false, code: "INTERNAL", message: "Terjadi kesalahan. Coba lagi." };
  }
}

export async function deleteProjectAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = projectIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Data tidak valid." };

    const deleted = await deleteProject(user.id, parsed.data.id);       // cek kepemilikan ada di query
    if (!deleted) return { ok: false, code: "NOT_FOUND", message: "Data tidak ditemukan." };
    revalidatePath("/projects");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, code: e.code, message: "Tidak diizinkan." };
    logger.error({ err: e, action: "deleteProject" });
    return { ok: false, code: "INTERNAL", message: "Terjadi kesalahan. Coba lagi." };
  }
}
```

Catatan: `"use server"` hanya mengekspor fungsi async. Konstanta/helper non-aksi ditaruh di `src/server/`.

---

## 6. Route Handler — presign upload R2 — `src/app/api/uploads/presign/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/server/auth/guards";
import { limit } from "@/server/security/rate-limit";
import { createPresignedPut } from "@/server/storage/r2";

const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const MAX_BYTES = 5 * 1024 * 1024;

const bodySchema = z
  .object({ contentType: z.enum(Object.keys(ALLOWED) as [keyof typeof ALLOWED, ...(keyof typeof ALLOWED)[]]), size: z.number().int().positive().max(MAX_BYTES) })
  .strict();

export async function POST(req: Request) {
  // CSRF: Route Handler pemakai cookie memeriksa Origin sendiri.
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(req.url).host) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  try {
    const user = await requireUser();
    if (!(await limit("upload:presign", user.id))) {
      return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60" } });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "VALIDATION" }, { status: 400 });

    const key = `uploads/${user.id}/${crypto.randomUUID()}.${ALLOWED[parsed.data.contentType]}`; // key dibuat server
    const url = await createPresignedPut({ key, contentType: parsed.data.contentType, size: parsed.data.size, expiresIn: 300 });
    return NextResponse.json({ url, key }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ code: e.code }, { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
    return NextResponse.json({ code: "INTERNAL" }, { status: 500 });
  }
}
```

---

## 7. Server Component (halaman) — `src/app/(app)/projects/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { getProjectForUser } from "@/server/project/service";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                            // Next 15+: params adalah Promise
  const user = await requireUser();                       // layout (app) juga memeriksa; ini lapis kedua
  const project = await getProjectForUser(user.id, id);
  if (!project) notFound();                               // bukan milik user = 404
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">{project.title}</h1>   {/* React meng-escape otomatis */}
    </main>
  );
}
```

---

## 8. Proxy (pagar kasar + CSP nonce) — `src/proxy.ts` (Next 16; di Next ≤ 15: `middleware.ts`)

```ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",           // tambah domain media R2 bila dipakai
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }],
};
// Pengecekan login TIDAK hanya di sini: tiap action/route/layout memanggil requireUser().
```

---

## 9. Hasil action seragam — `src/types/action.ts`

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED" | "CONFLICT" | "INTERNAL"; message: string; fieldErrors?: Record<string, string[] | undefined> };
```

---

## 10. Tes (Vitest) — pola minimum

```ts
describe("deleteProjectAction", () => {
  it("menghapus project milik sendiri", async () => { /* login sebagai A, hapus milik A → ok:true */ });
  it("menolak input tidak valid", async () => { /* id bukan cuid → VALIDATION */ });
  it("menolak tanpa login", async () => { /* tanpa sesi → UNAUTHENTICATED */ });
  it("menolak IDOR", async () => { /* login sebagai B, hapus milik A → NOT_FOUND, data A utuh */ });
});
```
