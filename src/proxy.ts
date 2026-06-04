import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { SessionPayload } from "@/lib/types";
import { logRequest } from "@/lib/request-logger";

const AUTH_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? "fallback-secret");
const PUBLIC_PATHS = ["/index/login", "/admin/login", "/merchant/login", "/api/public"];

async function getSessionFromCookie(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, AUTH_SECRET, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

function nextWithPathname(request: NextRequest, pathname: string) {
  const headers = new Headers(request.headers);
  headers.set("x-invoke-path", pathname);
  return NextResponse.next({ request: { headers } });
}

export default async function proxy(request: NextRequest) {
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

  const session = await getSessionFromCookie(request);

  if (!session) {
    const loginPath = isAdminRoute ? "/admin/login" : "/merchant/login";
    const loginUrl = new URL(loginPath, request.url);
    logRequest({ method: request.method, path: pathname, statusCode: 302, durationMs: Date.now() - start });
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session.end !== "PLATFORM_ADMIN") {
    logRequest({ method: request.method, path: pathname, statusCode: 403, durationMs: Date.now() - start });
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (isMerchantRoute && session.end !== "MERCHANT_STAFF") {
    logRequest({ method: request.method, path: pathname, statusCode: 403, durationMs: Date.now() - start });
    return new NextResponse("Forbidden", { status: 403 });
  }

  logRequest({ method: request.method, path: pathname, statusCode: 200, durationMs: Date.now() - start });
  return nextWithPathname(request, pathname);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)"
};
