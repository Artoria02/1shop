import type { SessionUser } from "@/lib/types";
import { prisma } from "@/db";

export async function checkPermission(user: SessionUser, permissionCode: string): Promise<boolean> {
  if (!user.roles.length) return false;

  const count = await prisma.rolePermission.count({
    where: {
      role: {
        code: { in: user.roles }
      },
      permission: {
        code: permissionCode
      }
    }
  });

  return count > 0;
}

export async function requirePermission(user: SessionUser, permissionCode: string): Promise<void> {
  const has = await checkPermission(user, permissionCode);
  if (!has) {
    const { ForbiddenError } = await import("@/lib/errors");
    throw new ForbiddenError(`Missing permission: ${permissionCode}`);
  }
}

export async function checkRole(user: SessionUser, allowedRoles: string[]): Promise<boolean> {
  return user.roles.some((role) => allowedRoles.includes(role));
}

export async function requireRole(user: SessionUser, allowedRoles: string[]): Promise<void> {
  const has = await checkRole(user, allowedRoles);
  if (!has) {
    const { ForbiddenError } = await import("@/lib/errors");
    throw new ForbiddenError(`Required role not found`);
  }
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      }
    }
  });

  const codes = new Set<string>();
  for (const ur of roles) {
    for (const rp of ur.role.permissions) {
      codes.add(rp.permission.code);
    }
  }

  return [...codes];
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true }
  });
  return roles.map((r) => r.role.code);
}