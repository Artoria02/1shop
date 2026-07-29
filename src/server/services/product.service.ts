import { prisma } from "@/db";
import { ProductStatus, ProductSaleStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { createMany as createSkus, deleteByProductId as deleteSkus } from "./sku.service";
import { getCategoryAndDescendantIds } from "./category.service";
import type { SkuInput } from "./sku.service";

export async function create(data: {
  merchantId: string;
  name: string;
  subtitle?: string;
  categoryId: string;
  brandId?: string;
  mainImage: string;
  images: string[];
  description?: string;
  specTemplate?: Prisma.InputJsonValue;
  skus: SkuInput[];
  status?: ProductStatus;
}) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) throw new NotFoundError("Category");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        merchantId: data.merchantId,
        name: data.name,
        subtitle: data.subtitle,
        categoryId: data.categoryId,
        brandId: data.brandId,
        mainImage: data.mainImage,
        images: data.images,
        description: data.description,
        specTemplate: data.specTemplate as Prisma.InputJsonValue,
        status: data.status ?? ProductStatus.DRAFT
      }
    });

    await tx.sku.createMany({
      data: data.skus.map((sku) => ({
        productId: product.id,
        skuCode: sku.skuCode,
        specs: sku.specs as Prisma.InputJsonValue,
        price: sku.price,
        originalPrice: sku.originalPrice,
        stock: sku.stock,
        image: sku.image
      }))
    });

    return product;
  });
}

export async function findById(id: string, merchantId?: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      skus: true,
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      merchant: { select: { id: true, name: true } }
    }
  });

  if (!product) throw new NotFoundError("Product");
  if (merchantId && product.merchantId !== merchantId) {
    throw new ForbiddenError("无权访问该商品");
  }

  return product;
}

export async function findMany(params: {
  merchantId?: string;
  status?: ProductStatus;
  saleStatus?: ProductSaleStatus;
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { merchantId, status, saleStatus, categoryId, search, page = 1, pageSize = 20 } = params;

  const where: Prisma.ProductWhereInput = {};
  if (merchantId) where.merchantId = merchantId;
  if (status) where.status = status;
  if (saleStatus) where.saleStatus = saleStatus;
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { subtitle: { contains: search, mode: "insensitive" } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        skus: { select: { price: true, stock: true } },
        category: { select: { name: true } }
      }
    }),
    prisma.product.count({ where })
  ]);

  return { items, total, page, pageSize };
}

export async function findBuyerProducts(params: {
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { categoryId, search, page = 1, pageSize = 20 } = params;

  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.APPROVED,
    saleStatus: ProductSaleStatus.ON_SALE
  };
  if (categoryId) {
    const categoryIds = await getCategoryAndDescendantIds(categoryId);
    where.categoryId = { in: categoryIds };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { subtitle: { contains: search, mode: "insensitive" } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        skus: { select: { price: true }, orderBy: { price: "asc" }, take: 1 },
        category: { select: { name: true } },
        merchant: { select: { name: true } }
      }
    }),
    prisma.product.count({ where })
  ]);

  return { items, total, page, pageSize };
}

export async function update(id: string, merchantId: string, data: {
  name?: string;
  subtitle?: string;
  categoryId?: string;
  brandId?: string;
  mainImage?: string;
  images?: string[];
  description?: string;
  specTemplate?: Prisma.InputJsonValue;
  skus?: SkuInput[];
}) {
  const product = await findById(id, merchantId);
  if (product.status === ProductStatus.PENDING) {
    throw new ValidationError("审核中的商品不可编辑");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        name: data.name,
        subtitle: data.subtitle,
        categoryId: data.categoryId,
        brandId: data.brandId,
        mainImage: data.mainImage,
        images: data.images,
        description: data.description,
        specTemplate: data.specTemplate as Prisma.InputJsonValue,
        status: ProductStatus.DRAFT
      }
    });

    if (data.skus) {
      await tx.sku.deleteMany({ where: { productId: id } });
      await tx.sku.createMany({
        data: data.skus.map((sku) => ({
          productId: id,
          skuCode: sku.skuCode,
          specs: sku.specs as Prisma.InputJsonValue,
          price: sku.price,
          originalPrice: sku.originalPrice,
          stock: sku.stock,
          image: sku.image
        }))
      });
    }

    return updated;
  });
}

export async function deleteProduct(id: string, merchantId: string) {
  const product = await findById(id, merchantId);
  if (product.status !== ProductStatus.DRAFT) {
    throw new ValidationError("只能删除草稿状态的商品");
  }

  return prisma.product.delete({ where: { id } });
}

export async function review(id: string, data: {
  status: ProductStatus;
  reviewedBy: string;
  reason?: string;
}) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError("Product");

  const validTransitions: Record<string, ProductStatus[]> = {
    DRAFT: [ProductStatus.PENDING],
    PENDING: [ProductStatus.APPROVED, ProductStatus.REJECTED],
    APPROVED: [ProductStatus.REJECTED],
    REJECTED: [ProductStatus.APPROVED, ProductStatus.PENDING]
  };

  if (!validTransitions[product.status].includes(data.status)) {
    throw new ValidationError(`无法将商品状态从 ${product.status} 变更为 ${data.status}`);
  }

  return prisma.product.update({
    where: { id },
    data: {
      status: data.status,
      reviewedBy: data.reviewedBy,
      reviewedAt: new Date(),
      rejectReason: data.status === ProductStatus.REJECTED ? data.reason : null
    }
  });
}

export async function toggleSaleStatus(id: string, merchantId: string, saleStatus: ProductSaleStatus) {
  const product = await findById(id, merchantId);
  if (product.status !== ProductStatus.APPROVED) {
    throw new ValidationError("只有审核通过的商品才能上下架");
  }

  return prisma.product.update({
    where: { id },
    data: { saleStatus }
  });
}
