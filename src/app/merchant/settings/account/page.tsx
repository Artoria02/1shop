import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/db";
import { findStaffs } from "@/server/services/merchant.service";
import { isOnline } from "@/server/services/auth.service";
import AccountForm from "./_components/account-form";

export default async function AccountSettingsPage() {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return null;

  // Try main account (User table)
  const mainUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { merchantId: true, email: true, phone: true, passwordHash: true }
  });

  if (mainUser?.merchantId) {
    const staffs = await findStaffs(user.merchantId);
    const staffsWithOnline = await Promise.all(
      staffs.map(async (s) => ({
        ...s,
        online: !!(await isOnline(user.merchantId!, s.id)),
      }))
    );
    return (
      <AccountForm
        isOwner={true}
        email={mainUser.email ?? ""}
        phone={mainUser.phone ?? ""}
        hasPassword={!!mainUser.passwordHash}
        staffs={staffsWithOnline}
      />
    );
  }

  // Staff account
  const staff = await prisma.merchantStaff.findUnique({
    where: { id: user.userId },
    select: { phone: true, passwordHash: true }
  });

  return (
    <AccountForm
      isOwner={false}
      email=""
      phone={staff?.phone ?? ""}
      hasPassword={!!staff?.passwordHash}
      staffs={[]}
    />
  );
}
