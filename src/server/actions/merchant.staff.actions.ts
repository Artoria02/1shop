"use server";

import { findStaffs, addStaff, removeStaff } from "@/server/services/merchant.service";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/db";
import { hashPassword } from "@/server/services/auth.service";
import { ValidationError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

export async function findStaffsAction() {
  const user = await getSessionUser();
  if (!user?.merchantId) throw new Error("无权限");

  return findStaffs(user.merchantId);
}

export type AddStaffState = { error?: string; success?: boolean; isNewUser?: boolean };

export async function addStaffAction(_prev: AddStaffState, formData: FormData): Promise<AddStaffState> {
  const user = await getSessionUser();
  if (!user?.merchantId) return { error: "无权限" };

  const currentStaff = await prisma.merchantStaff.findFirst({
    where: { userId: user.userId },
    select: { isOwner: true }
  });
  if (!currentStaff?.isOwner) return { error: "仅店主可添加员工" };

  const phone = formData.get("phone") as string;
  if (!phone) return { error: "请输入手机号" };

  try {
    let targetUser = await prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;

    if (!targetUser) {
      const passwordHash = await hashPassword("123456");
      targetUser = await prisma.user.create({
        data: {
          phone,
          passwordHash,
          displayName: `员工${phone.slice(-4)}`,
          source: "ADMIN_CREATED"
        }
      });
      isNewUser = true;
    } else if (!targetUser.passwordHash) {
      // 买家先注册（密码在 BuyerProfile），补充 User 密码用于商家端登录
      const passwordHash = await hashPassword("123456");
      await prisma.user.update({
        where: { id: targetUser.id },
        data: { passwordHash }
      });
    }

    // Always assign MERCHANT_STAFF role
    const merchantRole = await prisma.role.findUnique({ where: { code: "MERCHANT_STAFF" } });
    if (merchantRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: targetUser.id, roleId: merchantRole.id } },
        update: {},
        create: { userId: targetUser.id, roleId: merchantRole.id }
      });
    }

    const staffDisplayName = `员工${phone.slice(-4)}`;
    await addStaff(user.merchantId, targetUser.id, false, staffDisplayName);

    revalidatePath("/merchant/settings/staff");
    return { success: true, isNewUser };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "添加失败" };
  }
}

export async function removeStaffAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user?.merchantId) return;

  const currentStaff = await prisma.merchantStaff.findFirst({
    where: { userId: user.userId },
    select: { isOwner: true }
  });
  if (!currentStaff?.isOwner) return;

  const staffId = formData.get("staffId") as string;
  if (!staffId) return;

  await removeStaff(user.merchantId, staffId);
  revalidatePath("/merchant/settings/staff");
}
