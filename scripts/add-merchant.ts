import "dotenv/config";
import { prisma } from "../src/db/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const hash = await bcrypt.hash("merchant123", 12);
  const user = await prisma.user.upsert({
    where: { email: "merchant@1shop.local" },
    update: { passwordHash: hash, kind: "MERCHANT_STAFF" },
    create: {
      email: "merchant@1shop.local",
      displayName: "Test Merchant",
      passwordHash: hash,
      kind: "MERCHANT_STAFF",
      source: "SEED",
    },
  });
  console.log("Merchant created:", user.email);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
