import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(1, "品牌名称不能为空").max(50, "品牌名称最多50个字符"),
  logo: z.string().optional(),
  description: z.string().optional()
});

export const updateBrandSchema = z.object({
  name: z.string().min(1, "品牌名称不能为空").max(50, "品牌名称最多50个字符").optional(),
  logo: z.string().optional(),
  description: z.string().optional()
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
