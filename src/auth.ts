import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { serverEnv } from "@/lib/env";
import { authorizeCredentials } from "@/server/auth/credentials";

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
      // Logika (validasi, rate limit, verifikasi sandi) ada di authorizeCredentials agar teruji.
      authorize: (raw, request) => authorizeCredentials(raw, request.headers),
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
