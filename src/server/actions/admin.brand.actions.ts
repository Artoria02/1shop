"use server";

import { createBrandSchema, updateBrandSchema } from "@/server/validations/brand.validation";
import { create, update, toggleStatus } from "@/server/services/brand.service";
import { requireSessionUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function createBrandAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser("PLATFORM_ADMIN");
  await requirePermission(user, "brand:manage");

  const raw = {
    name: formData.get("name") as string,
    logo: (formData.get("logo") as string) || undefined,
    description: (formData.get("description") as string) || undefined
  };

  const parsed = createBrandSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message || "表单校验失败");
  }

  await create(parsed.data);
  revalidatePath("/admin/brands");
}

export async function updateBrandAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser("PLATFORM_ADMIN");
  await requirePermission(user, "brand:manage");

  const id = formData.get("id") as string;
  const raw: Record<string, unknown> = {};
  const name = formData.get("name") as string;
  const logo = formData.get("logo") as string;
  const description = formData.get("description") as string;

  if (name) raw.name = name;
  if (logo) raw.logo = logo;
  if (description) raw.description = description;

  const parsed = updateBrandSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message || "表单校验失败");
  }

  await update(id, parsed.data);
  revalidatePath("/admin/brands");
}

export async function toggleBrandStatusAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser("PLATFORM_ADMIN");
  await requirePermission(user, "brand:manage");

  const id = formData.get("id") as string;
  await toggleStatus(id);
  revalidatePath("/admin/brands");
}
