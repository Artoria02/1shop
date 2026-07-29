import { z } from "zod";

export const addCartItemSchema = z.object({
  skuId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
});

export const updateCartItemSchema = z.object({
  skuId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
});

export const removeCartItemSchema = z.object({
  skuId: z.string().min(1),
});

export const toggleSelectSchema = z.object({
  skuId: z.string().min(1),
  selected: z.coerce.boolean(),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
