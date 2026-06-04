import { prisma } from "@/db";
import type { Prisma } from "@prisma/client";

export interface SkuInput {
  skuCode: string;
  specs: Record<string, string>;
  price: number;
  originalPrice?: number;
  stock: number;
  image?: string;
}

export async function createMany(productId: string, skus: SkuInput[]) {
  const data: Prisma.SkuCreateManyInput[] = skus.map((sku) => ({
    productId,
    skuCode: sku.skuCode,
    specs: sku.specs,
    price: sku.price,
    originalPrice: sku.originalPrice,
    stock: sku.stock,
    image: sku.image
  }));

  return prisma.sku.createMany({ data });
}

export async function findByProductId(productId: string) {
  return prisma.sku.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" }
  });
}

export async function deleteByProductId(productId: string) {
  return prisma.sku.deleteMany({ where: { productId } });
}
