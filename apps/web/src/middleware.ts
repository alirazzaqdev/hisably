import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/invoices",
  "/quotations",
  "/customers",
  "/suppliers",
  "/items",
  "/payments",
  "/payables",
  "/expenses",
  "/reports",
  "/settings",
  "/onboarding",
];

const AUTH_PREFIXES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.get("hisably_session")?.value === "1";
  const { pathname } = request.nextUrl;

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/quotations/:path*",
    "/customers/:path*",
    "/suppliers/:path*",
    "/items/:path*",
    "/payments/:path*",
    "/payables/:path*",
    "/expenses/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/login",
    "/signup",
  ],
};
