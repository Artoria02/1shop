import { z } from "zod";

export const createOrderSchema = z.object({
  skuIds: z.string().transform((s) => {
    try {
      return JSON.parse(s) as string[];
    } catch {
      return [];
    }
  }).pipe(z.array(z.string().min(1)).min(1, "At least one item required")),
  addressId: z.string().min(1, "Address is required"),
  paymentMethod: z.enum(["WECHAT_PAY", "ALIPAY"]).default("WECHAT_PAY"),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().optional(),
});

export const confirmReceiptSchema = z.object({
  subOrderId: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
