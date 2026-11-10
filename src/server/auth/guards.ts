import "server-only";
import { auth } from "@/auth";
import { getUserById } from "@/server/user/service";
import type { Role } from "@/generated/prisma/client";

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  plan: "FREE" | "PRO";
};

// null bila tidak login atau akun sudah tidak ada. Role/plan selalu dari DB, bukan dari token.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return getUserById(id);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  return user;
}

export function requireRole(user: { role: Role }, allowed: Role[]): void {
  if (!allowed.includes(user.role)) throw new AuthError("FORBIDDEN");
}
