import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { findAddressesByUser } from "@/server/services/address.service";
import { UserCenterClient } from "./user-center-client";

export default async function UserCenterPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/index/login");

  const addresses = await findAddressesByUser(sessionUser.userId);

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: {
      avatar: true, displayName: true, email: true, phone: true,
      passwordHash: true,
      buyerProfile: { select: { passwordHash: true } }
    }
  });

  const user = {
    ...sessionUser,
    email: dbUser?.email ?? null,
    phone: dbUser?.phone ?? null,
    avatar: dbUser?.avatar ?? null,
    displayName: dbUser?.displayName ?? null,
    hasPassword: !!(dbUser?.passwordHash || dbUser?.buyerProfile?.passwordHash)
  };

  return <UserCenterClient user={user} addresses={addresses} />;
}
