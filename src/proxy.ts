import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { SessionPayload } from "@/lib/types";
import { logRequest } from "@/lib/request-logger";

const AUTH_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? "fallback-secret");
const PUBLIC_PATHS = ["/index/login", "/admin/login", "/merchant/login", "/merchant/apply", "/api/public"];

const SESSION_COOKIE_MAP = {
  admin:    "session_platform_admin",
  merchant: "session_merchant",
  buyer:    "session_buyer"
} as const;

async function getSessionForRoute(
  request: NextRequest,
  cookieName: string,
  allowedEnd: string
): Promise<SessionPayload | null> {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, AUTH_SECRET, { algorithms: ["HS256"] });
    if (payload.end !== allowedEnd) return null;
    return payload;
  } catch {
    return null;
  }
}

function nextWithPathname(request: NextRequest, pathname: string) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export default async function middleware(request: NextRequest) {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    logRequest({ method: request.method, path: pathname, statusCode: 200, durationMs: Date.now() - start });
    return nextWithPathname(request, pathname);
  }

  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|map)$/) || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isMerchantRoute = pathname.startsWith("/merchant");

  if (!isAdminRoute && !isMerchantRoute) {
    logRequest({ method: request.method, path: pathname, statusCode: 200, durationMs: Date.now() - start });
    return nextWithPathname(request, pathname);
  }

  if (isAdminRoute) {
    const session = await getSessionForRoute(request, SESSION_COOKIE_MAP.admin, "PLATFORM_ADMIN");
    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      logRequest({ method: request.method, path: pathname, statusCode: 302, durationMs: Date.now() - start });
      return NextResponse.redirect(loginUrl);
    }
  } else if (isMerchantRoute) {
    const session = await getSessionForRoute(request, SESSION_COOKIE_MAP.merchant, "MERCHANT");
    if (!session) {
      const loginUrl = new URL("/merchant/login", request.url);
      logRequest({ method: request.method, path: pathname, statusCode: 302, durationMs: Date.now() - start });
      return NextResponse.redirect(loginUrl);
    }
  }

  logRequest({ method: request.method, path: pathname, statusCode: 200, durationMs: Date.now() - start });
  return nextWithPathname(request, pathname);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)"
};
