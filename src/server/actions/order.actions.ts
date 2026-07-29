"use server";

import { requireSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import {
  createOrder,
  cancelOrder,
  confirmReceipt,
} from "@/server/services/order.service";
import {
  createOrderSchema,
} from "@/server/validations/order.validation";
import type { PaymentMethod } from "@prisma/client";

export type OrderActionState = {
  error?: string;
  success?: string;
  orderId?: string;
};

export async function createOrderAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const user = await requireSessionUser();

  const raw = {
    skuIds: formData.get("skuIds") as string,
    addressId: formData.get("addressId") as string,
    paymentMethod: (formData.get("paymentMethod") ?? "WECHAT_PAY") as string,
    direct: formData.get("direct") as string,
  };

  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const order = await createOrder({
      userId: user.userId,
      skuIds: parsed.data.skuIds,
      addressId: parsed.data.addressId,
      paymentMethod: parsed.data.paymentMethod as PaymentMethod,
      direct: raw.direct === "1",
    });
    return { success: "订单已创建", orderId: order.id };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

export async function cancelOrderAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const user = await requireSessionUser();

  const orderId = formData.get("orderId") as string;
  const reason = (formData.get("reason") as string) || undefined;

  if (!orderId) return { error: "订单ID缺失" };

  try {
    await cancelOrder(orderId, user.userId, reason);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { success: "订单已取消" };
}

export async function confirmReceiptAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const user = await requireSessionUser();

  const subOrderId = formData.get("subOrderId") as string;
  if (!subOrderId) return { error: "子订单ID缺失" };

  try {
    await confirmReceipt(subOrderId, user.userId);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/orders");
  return { success: "已确认收货" };
}
