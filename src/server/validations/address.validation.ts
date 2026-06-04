import { z } from "zod";

export const createAddressSchema = z.object({
  receiverName: z.string().min(1, "请输入收件人姓名"),
  receiverPhone: z.string().regex(/^1[3-9]\d{9}$/, "请输入正确的手机号"),
  province: z.string().min(1, "请选择省份"),
  city: z.string().min(1, "请选择城市"),
  district: z.string().min(1, "请选择区县"),
  detail: z.string().min(1, "请输入详细地址"),
  isDefault: z.boolean().optional()
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
