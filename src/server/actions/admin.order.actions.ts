"use server";

import { requireSessionUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { AppError } from "@/lib/errors";

export type AdminOrderActionState = { error?: string; success?: string };

export async function adminGetOrdersAction(): Promise<AdminOrderActionState> {
  try {
    const user = await requireSessionUser("PLATFORM_ADMIN");
    await requirePermission(user, "order:view");
    return { success: "authorized" };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
