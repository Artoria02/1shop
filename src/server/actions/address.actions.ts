"use server";

import { requireSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from "@/server/services/address.service";
import {
  createAddressSchema,
  updateAddressSchema
} from "@/server/validations/address.validation";

export type AddressActionState = { error?: string; success?: string };

export async function createAddressAction(_prev: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const user = await requireSessionUser();

  const raw = {
    receiverName: formData.get("receiverName") as string,
    receiverPhone: formData.get("receiverPhone") as string,
    province: formData.get("province") as string,
    city: formData.get("city") as string,
    district: formData.get("district") as string,
    detail: formData.get("detail") as string,
    isDefault: formData.get("isDefault") === "on"
  };

  const parsed = createAddressSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await createAddress(user.userId, parsed.data);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index/user");
  return { success: "地址已添加" };
}

export async function updateAddressAction(_prev: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const user = await requireSessionUser();
  const id = formData.get("id") as string;
  if (!id) return { error: "地址ID缺失" };

  const raw: Record<string, unknown> = {};
  const fields = ["receiverName", "receiverPhone", "province", "city", "district", "detail"] as const;
  for (const f of fields) {
    const v = formData.get(f);
    if (v) raw[f] = v;
  }
  raw.isDefault = formData.get("isDefault") === "on";

  const parsed = updateAddressSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await updateAddress(id, user.userId, parsed.data);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index/user");
  return { success: "地址已更新" };
}

export async function deleteAddressAction(_prev: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const user = await requireSessionUser();
  const id = formData.get("id") as string;
  if (!id) return { error: "地址ID缺失" };

  try {
    await deleteAddress(id, user.userId);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index/user");
  return { success: "地址已删除" };
}

export async function setDefaultAddressAction(_prev: AddressActionState, formData: FormData): Promise<AddressActionState> {
  const user = await requireSessionUser();
  const id = formData.get("id") as string;
  if (!id) return { error: "地址ID缺失" };

  try {
    await setDefaultAddress(id, user.userId);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/index/user");
  return {};
}
