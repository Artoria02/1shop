"use server";

import { loginWithPassword, createSession } from "@/server/services/auth.service";
import { clearSessionCookie } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UnauthorizedError } from "@/lib/errors";

export type LoginState = { error?: string };

export async function buyerLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "请输入邮箱和密码" };

  try {
    const result = await loginWithPassword(email, password, "BUYER");
    await createSession(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return { error: e.message };
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
    const result = await loginWithPassword(email, password, "PLATFORM_ADMIN");
    await createSession(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return { error: e.message };
    throw e;
  }

  revalidatePath("/admin");
  redirect("/admin");
}

export async function merchantLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "请输入邮箱和密码" };

  try {
    const result = await loginWithPassword(email, password, "MERCHANT_STAFF");
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