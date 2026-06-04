"use server";

import { reviewProductSchema } from "@/server/validations/product.validation";
import { review } from "@/server/services/product.service";
import { requireSessionUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { ProductStatus } from "@prisma/client";

export async function reviewProductAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  await requirePermission(user, "product:review");

  const id = formData.get("id") as string;
  const status = formData.get("status") as ProductStatus;
  const reason = (formData.get("reason") as string) || undefined;

  const parsed = reviewProductSchema.safeParse({ status, reason });
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message || "表单校验失败");
  }

  await review(id, { status: parsed.data.status, reviewedBy: user.userId, reason: parsed.data.reason });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}
