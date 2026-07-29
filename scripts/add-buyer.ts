import "dotenv/config";
import { prisma } from "../src/db/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const hash = await bcrypt.hash("buyer123", 12);
  const user = await prisma.user.upsert({
    where: { email: "buyer@1shop.local" },
    update: { passwordHash: hash },
    create: {
      email: "buyer@1shop.local",
      displayName: "Test Buyer",
      passwordHash: hash,
      source: "SEED",
    },
  });
  console.log("Buyer created:", user.email);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
