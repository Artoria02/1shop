import { z } from "zod";
import { ProductSaleStatus } from "@prisma/client";

const skuSchema = z.object({
  skuCode: z.string().min(1, "SKU编码不能为空"),
  specs: z.record(z.string(), z.string()),
  price: z.coerce.number().int().min(1, "售价必须大于0"),
  originalPrice: z.coerce.number().int().optional(),
  stock: z.coerce.number().int().min(0, "库存不能为负数").default(0),
  image: z.string().optional()
});

export const createProductSchema = z.object({
  name: z.string().min(1, "商品名称不能为空").max(100, "商品名称最多100个字符"),
  subtitle: z.string().max(200, "副标题最多200个字符").optional(),
  categoryId: z.string().min(1, "请选择类目"),
  brandId: z.string().optional(),
  mainImage: z.string().min(1, "请上传主图"),
  images: z.array(z.string()).max(9, "详情图最多9张").default([]),
  description: z.string().optional(),
  specTemplate: z.array(z.object({
    name: z.string().min(1),
    values: z.array(z.string().min(1)).min(1)
  })).optional(),
  skus: z.array(skuSchema).min(1, "至少需要一个SKU")
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subtitle: z.string().max(200).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  mainImage: z.string().optional(),
  images: z.array(z.string()).max(9).optional(),
  description: z.string().optional(),
  specTemplate: z.array(z.object({
    name: z.string().min(1),
    values: z.array(z.string().min(1)).min(1)
  })).optional(),
  skus: z.array(skuSchema).optional()
});

export const reviewProductSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().optional()
});

export const toggleSaleStatusSchema = z.object({
  saleStatus: z.enum([ProductSaleStatus.ON_SALE, ProductSaleStatus.OFF_SHELF])
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ReviewProductInput = z.infer<typeof reviewProductSchema>;
export type ToggleSaleStatusInput = z.infer<typeof toggleSaleStatusSchema>;
