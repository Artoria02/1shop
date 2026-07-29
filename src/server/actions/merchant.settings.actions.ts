"use server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/db";
import { updateMerchant, changeStaffPassword } from "@/server/services/merchant.service";
import { changePassword, hashPassword, validatePassword } from "@/server/services/auth.service";
import { updateInfoSchema, updatePaymentSchema, changePasswordSchema } from "@/server/validations/settings.validation";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

export type SettingsState = { error?: string; success?: string };

export async function updateInfoAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return { error: "无权限" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateInfoSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "表单数据有误" };

  try {
    await updateMerchant(user.merchantId, parsed.data);
    revalidatePath("/merchant/settings/info");
    return { success: "店铺信息已更新" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
}

export async function updatePaymentAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return { error: "无权限" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = updatePaymentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "表单数据有误" };

  try {
    await updateMerchant(user.merchantId, parsed.data);
    revalidatePath("/merchant/settings/payment");
    return { success: "支付信息已更新" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
}

export async function updateShippingAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return { error: "无权限" };

  const address = formData.get("address") as string;

  try {
    await updateMerchant(user.merchantId, { address });
    revalidatePath("/merchant/settings/shipping");
    return { success: "配送信息已更新" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
}

export async function setPasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getSessionUser("MERCHANT");
  if (!user) return { error: "请先登录" };

  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 6) return { error: "新密码至少6位" };
  if (newPassword !== confirmPassword) return { error: "两次输入的密码不一致" };

  try {
    const newHash = await hashPassword(newPassword);

    const mainUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { merchantId: true }
    });

    if (mainUser?.merchantId) {
      await prisma.user.update({ where: { id: user.userId }, data: { passwordHash: newHash } });
    } else {
      await prisma.merchantStaff.update({ where: { id: user.userId }, data: { passwordHash: newHash } });
    }

    revalidatePath("/merchant/settings/account");
    return { success: "密码已设置" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "设置失败" };
  }
}

export async function changeEmailAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return { error: "无权限" };

  const newEmail = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  if (!newEmail) return { error: "请输入新邮箱" };
  if (!password) return { error: "请输入密码" };

  try {
    const mainUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { merchantId: true, passwordHash: true }
    });
    if (!mainUser?.merchantId) return { error: "仅店主可修改邮箱" };

    const valid = await validatePassword(password, mainUser.passwordHash ?? "");
    if (!valid) throw new AppError("密码错误", 400, "WRONG_PASSWORD");

    await prisma.user.update({ where: { id: user.userId }, data: { email: newEmail } });
    revalidatePath("/merchant/settings/account");
    return { success: "邮箱已更新" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
}

export async function changePhoneAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getSessionUser("MERCHANT");
  if (!user?.merchantId) return { error: "无权限" };

  const newPhone = (formData.get("phone") as string)?.trim();
  const password = formData.get("password") as string;
  if (!newPhone) return { error: "请输入新手机号" };
  if (!password) return { error: "请输入密码" };

  try {
    // Find the account's password hash to verify
    const mainUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { merchantId: true, passwordHash: true }
    });

    let hash: string | null | undefined;
    if (mainUser?.merchantId) {
      hash = mainUser.passwordHash;
    } else {
      const staff = await prisma.merchantStaff.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true }
      });
      hash = staff?.passwordHash;
    }

    const valid = await validatePassword(password, hash ?? "");
    if (!valid) throw new AppError("密码错误", 400, "WRONG_PASSWORD");

    if (mainUser?.merchantId) {
      await prisma.user.update({ where: { id: user.userId }, data: { phone: newPhone } });
    } else {
      await prisma.merchantStaff.update({ where: { id: user.userId }, data: { phone: newPhone } });
    }

    revalidatePath("/merchant/settings/account");
    return { success: "手机号已更新" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
}

export async function changePasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getSessionUser("MERCHANT");
  if (!user) return { error: "请先登录" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "表单数据有误" };

  try {
    // Check if this is the main account (User table) or a staff account
    const mainUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { merchantId: true, passwordHash: true }
    });

    if (mainUser?.merchantId) {
      // Main account owner
      await changePassword(user.userId, parsed.data.oldPassword, parsed.data.newPassword);
    } else {
      // Staff account
      const staff = await prisma.merchantStaff.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true }
      });
      if (!staff) return { error: "账号不存在" };

      const valid = await validatePassword(parsed.data.oldPassword, staff.passwordHash ?? "");
      if (!valid) throw new AppError("原密码错误", 400, "WRONG_PASSWORD");

      const newHash = await hashPassword(parsed.data.newPassword);
      await changeStaffPassword(user.userId, newHash);
    }

    return { success: "密码已修改，请重新登录" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "修改失败" };
  }
}
