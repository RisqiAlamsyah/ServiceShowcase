import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { serverEnv } from "@/lib/env";
import { loginSchema } from "@/lib/validation/auth";
import { verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { RATE_RULES, clientIp, consume } from "@/server/auth/rate-limit";
import { findUserForLogin } from "@/server/user/service";

// Sesi JWT berumur pendek (Credentials memaksa JWT). Token hanya memuat ID; role/plan dibaca
// ulang dari DB oleh requireUser() (RULES_SECURITY §2.2).
const SESSION_MAX_AGE_SECONDS = 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: serverEnv.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/masuk" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // Dipanggil juga oleh endpoint /api/auth/callback/credentials, jadi rate limit ada di sini
      // (bukan hanya di Server Action). Semua jalur gagal mengembalikan null (pesan generik).
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = clientIp(request.headers);
        const [okEmail, okIp] = await Promise.all([
          consume("login:email", email, RATE_RULES.loginEmail),
          consume("login:ip", ip, RATE_RULES.loginIp),
        ]);
        if (!okEmail || !okIp) return null;

        const user = await findUserForLogin(email);
        // Akun tanpa sandi (mis. Google SSO nanti) tidak bisa masuk lewat form ini.
        const valid = user?.passwordHash
          ? await verifyPassword(user.passwordHash, password)
          : await verifyAgainstDummy(password);
        if (!user || !valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Hanya ID yang masuk ke token/sesi. Tanpa passwordHash, role, atau plan.
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
