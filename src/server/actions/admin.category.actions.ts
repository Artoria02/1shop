"use server";

import { createCategorySchema, updateCategorySchema } from "@/server/validations/category.validation";
import { create, update, toggleStatus } from "@/server/services/category.service";
import { requireSessionUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function createCategoryAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  await requirePermission(user, "category:manage");

  const raw = {
    name: formData.get("name") as string,
    parentId: (formData.get("parentId") as string) || undefined,
    sortOrder: parseInt((formData.get("sortOrder") as string) || "0", 10),
    icon: (formData.get("icon") as string) || undefined
  };

  const parsed = createCategorySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message || "表单校验失败");
  }

  await create(parsed.data);
  revalidatePath("/admin/categories");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  await requirePermission(user, "category:manage");

  const id = formData.get("id") as string;
  const raw: Record<string, unknown> = {};
  const name = formData.get("name") as string;
  const sortOrder = formData.get("sortOrder") as string;
  const icon = formData.get("icon") as string;

  if (name) raw.name = name;
  if (sortOrder) raw.sortOrder = parseInt(sortOrder, 10);
  if (icon) raw.icon = icon;

  const parsed = updateCategorySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message || "表单校验失败");
  }

  await update(id, parsed.data);
  revalidatePath("/admin/categories");
}

export async function toggleCategoryStatusAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  await requirePermission(user, "category:manage");

  const id = formData.get("id") as string;
  await toggleStatus(id);
  revalidatePath("/admin/categories");
}
