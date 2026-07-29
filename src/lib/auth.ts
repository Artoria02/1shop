import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionPayload, SessionUser, LoginEnd } from "@/lib/types";
import { env } from "@/lib/env";

const AUTH_SECRET = new TextEncoder().encode(env.authSecret);
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function cookieName(end: string): string {
  return `session_${end.toLowerCase()}`;
}

const ALL_SESSION_COOKIES = [
  cookieName("BUYER"),
  cookieName("MERCHANT"),
  cookieName("PLATFORM_ADMIN"),
];

export async function signToken(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .setSubject(payload.sub)
    .sign(AUTH_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, AUTH_SECRET, {
      algorithms: ["HS256"]
    });
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: Omit<SessionPayload, "iat" | "exp">): Promise<void> {
  const token = await signToken(payload);
  const isProduction = env.appEnv === "production";
  const cookieStore = await cookies();

  cookieStore.set(cookieName(payload.end), token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}

export async function clearSessionCookie(end?: LoginEnd): Promise<void> {
  const cookieStore = await cookies();
  if (end) {
    cookieStore.delete(cookieName(end));
  } else {
    for (const name of ALL_SESSION_COOKIES) {
      cookieStore.delete(name);
    }
  }
}

export async function getSessionUser(end?: LoginEnd): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const names = end ? [cookieName(end)] : ALL_SESSION_COOKIES;

  let payload: SessionPayload | null = null;

  for (const name of names) {
    const token = cookieStore.get(name)?.value;
    if (!token) continue;
    payload = await verifyToken(token);
    if (payload) break;
  }

  if (!payload) return null;

  // 商家端：校验 session token 实现单设备登录
  if (payload.end === "MERCHANT" && payload.merchantId && payload.sessionToken) {
    const { redis } = await import("@/db");
    const storedToken = await redis.get(`online:${payload.merchantId}:${payload.sub}`);
    if (storedToken !== payload.sessionToken) {
      try {
        await clearSessionCookie("MERCHANT");
      } catch {
        // getSessionUser may be called from a Server Component where cookie
        // modification is restricted. The stale cookie will be overwritten
        // on next login; treat the user as logged out.
      }
      return null;
    }
  }

  let avatar: string | undefined;
  let displayName: string | undefined;
  let staff: boolean | undefined;

  try {
    const { prisma } = await import("@/db");

    if (payload.end === "MERCHANT") {
      const merchantUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { displayName: true, avatar: true, merchantId: true }
      });
      if (merchantUser?.merchantId) {
        displayName = merchantUser.displayName ?? undefined;
        avatar = merchantUser.avatar ?? undefined;
      } else {
        const staffRecord = await prisma.merchantStaff.findUnique({
          where: { id: payload.sub },
          select: { nickname: true, status: true }
        });
        if (!staffRecord || staffRecord.status !== "ACTIVE") return null;
        displayName = staffRecord.nickname;
        staff = true;
      }
    } else if (payload.end === "BUYER") {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { displayName: true, avatar: true }
      });
      if (!user) return null;
      displayName = user.displayName ?? undefined;
      avatar = user.avatar ?? undefined;
    } else if (payload.end === "PLATFORM_ADMIN") {
      const admin = await prisma.platformAdmin.findUnique({
        where: { id: payload.sub },
        select: { displayName: true, avatar: true }
      });
      if (!admin) return null;
      displayName = admin.displayName ?? undefined;
      avatar = admin.avatar ?? undefined;
    }
  } catch {
    // Fall through — return basic session without profile enrichment
  }

  return {
    userId: payload.sub,
    email: null,
    phone: null,
    end: payload.end,
    roles: payload.roles,
    merchantId: payload.merchantId,
    avatar,
    displayName,
    staff,
  };
}

export async function requireSessionUser(end?: LoginEnd): Promise<SessionUser> {
  const user = await getSessionUser(end);
  if (!user) {
    const { UnauthorizedError } = await import("@/lib/errors");
    throw new UnauthorizedError();
  }
  return user;
}
