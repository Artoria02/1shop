"use server";

import { requireSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createShipment } from "@/server/services/shipment.service";
import { createShipmentSchema } from "@/server/validations/shipment.validation";

export type ShipActionState = { error?: string; success?: string };

export async function shipOrderAction(
  _prev: ShipActionState,
  formData: FormData
): Promise<ShipActionState> {
  const user = await requireSessionUser("MERCHANT");
  if (!user.merchantId) {
    return { error: "您还没有关联的店铺" };
  }

  const raw = {
    subOrderId: formData.get("subOrderId") as string,
    carrier: formData.get("carrier") as string,
    trackingNo: formData.get("trackingNo") as string,
  };

  const parsed = createShipmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await createShipment(
      parsed.data.subOrderId,
      user.merchantId,
      parsed.data.carrier,
      parsed.data.trackingNo
    );
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }

  revalidatePath("/merchant/orders");
  revalidatePath(`/merchant/orders/${parsed.data.subOrderId}`);
  return { success: "已发货" };
}

export async function shipOrderFormAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser("MERCHANT");
  if (!user.merchantId) throw new Error("No merchant associated");

  const raw = {
    subOrderId: formData.get("subOrderId") as string,
    carrier: formData.get("carrier") as string,
    trackingNo: formData.get("trackingNo") as string,
  };

  const parsed = createShipmentSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await createShipment(
    parsed.data.subOrderId,
    user.merchantId,
    parsed.data.carrier,
    parsed.data.trackingNo
  );

  revalidatePath("/merchant/orders");
  revalidatePath(`/merchant/orders/${parsed.data.subOrderId}`);
}
