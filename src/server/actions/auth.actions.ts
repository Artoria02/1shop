"use server";

import { loginWithPassword, loginAsMerchant, loginAsAdmin, createSession, registerUser, sendLoginSmsCode, loginByPhone, updateProfile, changeEmail, changePhone, changePassword } from "@/server/services/auth.service";
import { clearSessionCookie, requireSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UnauthorizedError, AppError } from "@/lib/errors";

export type LoginState = { error?: string };
export type RegisterState = { error?: string; success?: string };

export async function buyerLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const account = formData.get("account") as string;
  const password = formData.get("password") as string;

  if (!account || !password) return { error: "请输入账号和密码" };

  try {
    const result = await loginWithPassword(account, password);
    await createSession(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index");
  redirect("/index");
}

export type SmsCodeState = { error?: string; sent?: boolean };

export async function sendSmsCodeAction(_prev: SmsCodeState, formData: FormData): Promise<SmsCodeState> {
  const phone = formData.get("phone") as string;

  if (!phone) return { error: "请输入手机号" };

  try {
    await sendLoginSmsCode(phone);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  return { sent: true };
}

export async function phoneLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = formData.get("phone") as string;
  const code = formData.get("code") as string;

  if (!phone || !code) return { error: "请输入手机号和验证码" };

  try {
    const result = await loginByPhone(phone, code);
    await createSession(result);
  } catch (e) {
    if (e instanceof AppError || e instanceof UnauthorizedError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index");
  redirect("/index");
}

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const phone = formData.get("phone") as string;
  const code = formData.get("code") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!phone || !code || !password || !confirmPassword) return { error: "请填写所有字段" };
  if (password !== confirmPassword) return { error: "两次输入的密码不一致" };

  try {
    const result = await registerUser({ phone, code, password, email: email || undefined });
    await createSession(result);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index");
  redirect("/index");
}

export async function adminLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "请输入邮箱和密码" };

  try {
    const result = await loginAsAdmin(email, password);
    await createSession(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return { error: e.message };
    throw e;
  }

  revalidatePath("/admin");
  redirect("/admin");
}

export async function merchantLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const account = formData.get("account") as string;
  const password = formData.get("password") as string;

  if (!account || !password) return { error: "请输入账号和密码" };

  try {
    const result = await loginAsMerchant(account, password);
    await createSession(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return { error: e.message };
    throw e;
  }

  revalidatePath("/merchant");
  redirect("/merchant");
}

export async function logoutAction(formData: FormData) {
  await clearSessionCookie();
  const redirectTo = (formData.get("redirectTo") as string) || "/index/login";
  redirect(redirectTo);
}

export type ProfileActionState = { error?: string; success?: string };

export async function updateProfileAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await requireSessionUser();
  const displayName = formData.get("displayName") as string;
  const avatar = formData.get("avatar") as string;

  try {
    await updateProfile(user.userId, { displayName, avatar });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index/user");
  return { success: "资料已更新" };
}

export async function changeEmailAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await requireSessionUser();
  const newEmail = formData.get("newEmail") as string;
  const password = formData.get("password") as string;

  if (!newEmail || !password) return { error: "请填写所有字段" };

  try {
    await changeEmail(user.userId, newEmail, password);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index/user");
  return { success: "邮箱已更换" };
}

export async function changePhoneAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await requireSessionUser();
  const newPhone = formData.get("newPhone") as string;
  const code = formData.get("code") as string;
  const password = formData.get("password") as string;

  if (!newPhone || !code || !password) return { error: "请填写所有字段" };

  try {
    await changePhone(user.userId, newPhone, code, password);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index/user");
  return { success: "手机号已更换" };
}

export async function changePasswordAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const user = await requireSessionUser();
  const oldPassword = (formData.get("oldPassword") as string) || "";
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || !confirmPassword) return { error: "请填写所有字段" };
  if (newPassword !== confirmPassword) return { error: "两次输入的新密码不一致" };

  try {
    await changePassword(user.userId, oldPassword, newPassword);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  return { success: "密码已修改" };
}