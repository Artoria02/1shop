import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/db";
import { findByUserId } from "@/server/services/merchant.service";
import MerchantLayoutClient from "./_components/merchant-layout-client";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const path = h.get("x-pathname") || "";
  if (path === "/merchant/login" || path === "/merchant/apply") return <>{children}</>;

  const user = await getSessionUser("MERCHANT");
  if (!user || user.end !== "MERCHANT") redirect("/merchant/login");

  const merchant = user.merchantId ? await findByUserId(user.userId) : null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true }
  });
  const email = dbUser?.email ?? "";

  return (
    <MerchantLayoutClient user={user} merchant={merchant} email={email}>
      {children}
    </MerchantLayoutClient>
  );
}
