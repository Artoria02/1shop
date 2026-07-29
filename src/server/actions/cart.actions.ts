"use server";

import { getSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addItem,
  updateItem,
  removeItem,
  toggleSelect,
  selectAll,
} from "@/server/services/cart.service";
import {
  addCartItemSchema,
  updateCartItemSchema,
  removeCartItemSchema,
} from "@/server/validations/cart.validation";

export type CartActionState = { error?: string; success?: string };

async function requireAuth() {
  const user = await getSessionUser("BUYER");
  if (!user) redirect("/index/login");
  return user;
}

export async function addToCartAction(
  _prev: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const user = await requireAuth();

  const raw = {
    skuId: formData.get("skuId") as string,
    productId: formData.get("productId") as string,
    quantity: formData.get("quantity") as string,
  };

  const parsed = addCartItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await addItem(
      user.userId,
      parsed.data.skuId,
      parsed.data.productId,
      parsed.data.quantity
    );
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/cart");
  return { success: "已加入购物车" };
}

export async function updateCartAction(
  _prev: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const user = await requireAuth();

  const raw = {
    skuId: formData.get("skuId") as string,
    quantity: formData.get("quantity") as string,
  };

  const parsed = updateCartItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await updateItem(user.userId, parsed.data.skuId, parsed.data.quantity);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/cart");
  return { success: "已更新" };
}

export async function removeCartAction(
  _prev: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const user = await requireAuth();

  const raw = {
    skuId: formData.get("skuId") as string,
  };

  const parsed = removeCartItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await removeItem(user.userId, parsed.data.skuId);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/cart");
  return { success: "已移除" };
}

export async function toggleCartSelectAction(
  _prev: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const user = await requireAuth();

  const skuId = formData.get("skuId") as string;
  const selected = formData.get("selected") === "true";

  try {
    await toggleSelect(user.userId, skuId, selected);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/cart");
  return { success: "已更新" };
}

export async function selectAllCartAction(
  _prev: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const user = await requireAuth();
  const selected = formData.get("selected") === "true";

  try {
    await selectAll(user.userId, selected);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/cart");
  return { success: selected ? "已全选" : "已取消全选" };
}
