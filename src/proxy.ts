import { NextResponse, type NextRequest } from "next/server";

// Next.js 16: "middleware" diganti nama menjadi "proxy". CSP ber-nonce per request (RULES_SECURITY §5).
// Proxy hanyalah lapis kasar; otorisasi sebenarnya ada di tiap action/route/layout (RULES_SECURITY §3.5).
// Nama cookie sesi Auth.js (dengan/tanpa awalan __Secure- dan potongan .0/.1).
const SESSION_COOKIE = "authjs.session-token";

export function proxy(request: NextRequest) {
  // Pagar kasar: tanpa cookie sesi, /dashboard diarahkan ke login. Validasi sesi sebenarnya
  // ada di layout (app) dan tiap action, karena cookie ini hanya dicek keberadaannya.
  const { pathname, search } = request.nextUrl;
  if (
    (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) &&
    !request.cookies.getAll().some((c) => c.name.includes(SESSION_COOKIE))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:", // fitur upload menambah domain media R2 di sini
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
