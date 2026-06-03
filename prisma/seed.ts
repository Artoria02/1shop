import { prisma } from "../src/db/prisma";
import { UserKind, RegisterSource, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { code: "PLATFORM_ADMIN" },
    update: {},
    create: { code: "PLATFORM_ADMIN", name: "平台管理员" }
  });

  const merchantRole = await prisma.role.upsert({
    where: { code: "MERCHANT_STAFF" },
    update: {},
    create: { code: "MERCHANT_STAFF", name: "商家员工" }
  });

  const buyerRole = await prisma.role.upsert({
    where: { code: "BUYER" },
    update: {},
    create: { code: "BUYER", name: "买家" }
  });

  console.log("Roles created.");

  // Create default admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@1shop.com" },
    update: {},
    create: {
      email: "admin@1shop.com",
      passwordHash,
      displayName: "平台管理员",
      kind: UserKind.PLATFORM_ADMIN,
      source: RegisterSource.WEB
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id }
  });

  console.log("Default admin user created: admin@1shop.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
