import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "类目名称不能为空").max(50, "类目名称最多50个字符"),
  parentId: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  icon: z.string().optional()
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, "类目名称不能为空").max(50, "类目名称最多50个字符").optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  icon: z.string().optional()
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
