"use server";

import { reviewMerchantSchema } from "@/server/validations/merchant.validation";
import { review } from "@/server/services/merchant.service";
import { requireSessionUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { MerchantStatus } from "@prisma/client";

export async function reviewMerchantAction(
  _prevState: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  try {
    const user = await requireSessionUser("PLATFORM_ADMIN");
    await requirePermission(user, "merchant:review");

    const id = formData.get("id") as string;
    const status = formData.get("status") as MerchantStatus;
    const reason = (formData.get("reason") as string) || undefined;

    const parsed = reviewMerchantSchema.safeParse({ status, reason });
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message || "表单校验失败";
      return { error: message };
    }

    await review(id, { status: parsed.data.status, reviewedBy: user.userId, reason: parsed.data.reason });

    revalidatePath("/admin/merchants");
    revalidatePath(`/admin/merchants/${id}`);

    return { success: "操作成功" };
  } catch (e) {
    if (e instanceof Error) {
      return { error: e.message };
    }
    return { error: "操作失败" };
  }
}
