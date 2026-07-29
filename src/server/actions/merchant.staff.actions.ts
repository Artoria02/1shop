"use server";

import { findStaffs, addStaff, removeStaff } from "@/server/services/merchant.service";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/db";
import { hashPassword } from "@/server/services/auth.service";
import { sendSms } from "@/lib/sms";
import { ValidationError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function findStaffsAction() {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) throw new Error("无权限");

  return findStaffs(user.merchantId);
}

export type AddStaffState = { error?: string; success?: boolean };

function generatePassword(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function addStaffAction(_prev: AddStaffState, formData: FormData): Promise<AddStaffState> {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return { error: "无权限" };

  const currentUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { merchantId: true }
  });
  if (!currentUser?.merchantId) return { error: "仅店主可添加子账号" };

  const nickname = (formData.get("nickname") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  if (!nickname) return { error: "请输入账号昵称" };
  if (!phone) return { error: "请输入手机号" };

  const merchant = await prisma.merchant.findUnique({
    where: { id: user.merchantId },
    select: { name: true }
  });
  if (!merchant) return { error: "店铺不存在" };

  const accountName = `${merchant.name}:${nickname}`;

  try {
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    await addStaff(user.merchantId, accountName, nickname, phone, passwordHash);

    await sendSms(phone, `【1Shop】您已被添加为子账号。账号：${accountName}，初始密码：${password}，请登录后及时修改密码。`);

    revalidatePath("/merchant/settings/account");
    return { success: true };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "添加失败" };
  }
}

export async function removeStaffAction(formData: FormData): Promise<void> {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return;

  const currentUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { merchantId: true }
  });
  if (!currentUser?.merchantId) return;

  const staffId = formData.get("staffId") as string;
  if (!staffId) return;

  await removeStaff(user.merchantId, staffId);
  revalidatePath("/merchant/settings/account");
}
