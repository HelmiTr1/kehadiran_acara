import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kehadiran-acara-secret-change-in-production"
);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("session")?.value;

  let loggedIn = false;
  let jwtRole: string | undefined;
  if (sessionCookie) {
    try {
      const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
      loggedIn = true;
      jwtRole = payload.role as string | undefined;
    } catch {
      loggedIn = false;
    }
  }

  if (pathname.startsWith("/login") && loggedIn) {
    const target = jwtRole === "user" ? "/" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (!/^\/api\//.test(pathname) && !pathname.startsWith("/login") && !loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.png$).*)",
  ],
};