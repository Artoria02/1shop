import { prisma } from "@/db";
import { setSessionCookie } from "@/lib/auth";
import type { SessionPayload } from "@/lib/types";
import type { User, UserKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppError, UnauthorizedError } from "@/lib/errors";

const SALT_ROUNDS = 12;

export interface AuthResult {
  user: User;
  sessionPayload: Omit<SessionPayload, "iat" | "exp">;
}

export async function loginWithPassword(
  email: string,
  password: string,
  kind?: string
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError("邮箱或密码错误");
  }

  if (kind && user.kind !== kind) {
    throw new UnauthorizedError("邮箱或密码错误");
  }

  if (user.status !== "ACTIVE") {
    throw new UnauthorizedError("账号已被禁用");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("邮箱或密码错误");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const { getUserRoles } = await import("@/lib/rbac");
  const roles = await getUserRoles(user.id);

  return {
    user,
    sessionPayload: {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      kind: user.kind as UserKind,
      roles
    }
  };
}

export async function registerAdmin(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      kind: "PLATFORM_ADMIN",
      source: "ADMIN_CREATED"
    }
  });
}

export async function createSession(authResult: AuthResult): Promise<void> {
  await setSessionCookie(authResult.sessionPayload);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}