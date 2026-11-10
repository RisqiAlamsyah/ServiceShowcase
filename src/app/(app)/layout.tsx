import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/server/auth/guards";

// Pagar sebenarnya untuk halaman login (proxy hanya lapis kasar; RULES_SECURITY §3.5).
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/masuk?next=/dashboard");
  return children;
}
