import { prisma } from "@/db";
import { Prisma, UserKind, RegisterSource } from "@prisma/client";
import { UnauthorizedError } from "@/lib/errors";
import { compare } from "bcryptjs";
import { hash } from "bcryptjs";

export async function findById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { roleAssignments: { include: { role: true } } }
  });
}

export async function findByPhone(phone: string) {
  return prisma.user.findUnique({ where: { phone } });
}

export async function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(input: {
  email?: string;
  phone?: string;
  password: string;
  displayName?: string;
  kind?: UserKind;
}) {
  const passwordHash = await hash(input.password, 12);

  return prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      displayName: input.displayName,
      kind: input.kind ?? UserKind.BUYER,
      source: RegisterSource.WEB
    }
  });
}

export async function assignRole(userId: string, roleCode: string) {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new Error("Role not found");

  return prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id }
  });
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true }
  });
  if (!user?.passwordHash) return false;
  return compare(password, user.passwordHash);
}