"use server";

import { createProductSchema, updateProductSchema, toggleSaleStatusSchema } from "@/server/validations/product.validation";
import { create, update, toggleSaleStatus, deleteProduct, review } from "@/server/services/product.service";
import { requireSessionUser } from "@/lib/auth";
import { ValidationError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { ProductSaleStatus, ProductStatus, type Prisma } from "@prisma/client";

export type ProductActionState = { error?: string; success?: boolean; productId?: string; message?: string };

export async function createProductAction(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  try {
    const user = await requireSessionUser("MERCHANT");
    if (!user.merchantId) {
      return { error: "您还没有关联的店铺" };
    }

    const raw = {
      name: formData.get("name") as string,
      subtitle: (formData.get("subtitle") as string) || undefined,
      categoryId: formData.get("categoryId") as string,
      brandId: (formData.get("brandId") as string) || undefined,
      mainImage: formData.get("mainImage") as string,
      images: JSON.parse((formData.get("images") as string) || "[]") as string[],
      description: (formData.get("description") as string) || undefined,
      specTemplate: JSON.parse((formData.get("specTemplate") as string) || "null") as unknown,
      skus: JSON.parse((formData.get("skus") as string) || "[]") as unknown
    };

    const parsed = createProductSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues?.[0]?.message || "表单校验失败" };
    }

    const isSubmit = (formData.get("action") as string) === "submit";
    const status = isSubmit ? ProductStatus.PENDING : ProductStatus.DRAFT;

    const product = await create({
      ...parsed.data,
      merchantId: user.merchantId,
      status,
      specTemplate: parsed.data.specTemplate as Prisma.InputJsonValue,
      skus: parsed.data.skus.map((sku) => ({
        skuCode: sku.skuCode,
        specs: sku.specs,
        price: sku.price,
        originalPrice: sku.originalPrice,
        stock: sku.stock,
        image: sku.image
      }))
    });

    revalidatePath("/merchant/products");
    return {
      success: true,
      productId: product.id,
      message: isSubmit ? "商品已提交审核" : "草稿已保存"
    };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "创建失败" };
  }
}

export async function updateProductAction(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  try {
    const user = await requireSessionUser("MERCHANT");
    if (!user.merchantId) {
      return { error: "您还没有关联的店铺" };
    }

    const id = formData.get("id") as string;
    const raw: Record<string, unknown> = {};

    const name = formData.get("name") as string;
    const subtitle = formData.get("subtitle") as string;
    const categoryId = formData.get("categoryId") as string;
    const brandId = formData.get("brandId") as string;
    const mainImage = formData.get("mainImage") as string;
    const description = formData.get("description") as string;

    if (name) raw.name = name;
    if (subtitle) raw.subtitle = subtitle;
    if (categoryId) raw.categoryId = categoryId;
    if (brandId) raw.brandId = brandId;
    if (mainImage) raw.mainImage = mainImage;
    if (description) raw.description = description;

    const images = formData.get("images") as string;
    if (images) raw.images = JSON.parse(images);

    const specTemplate = formData.get("specTemplate") as string;
    if (specTemplate) raw.specTemplate = JSON.parse(specTemplate);

    const skus = formData.get("skus") as string;
    if (skus) raw.skus = JSON.parse(skus);

    const parsed = updateProductSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues?.[0]?.message || "表单校验失败" };
    }

    const isSubmit = (formData.get("action") as string) === "submit";

    await update(id, user.merchantId, {
      ...parsed.data,
      specTemplate: parsed.data.specTemplate as Prisma.InputJsonValue,
      skus: parsed.data.skus?.map((sku) => ({
        skuCode: sku.skuCode,
        specs: sku.specs,
        price: sku.price,
        originalPrice: sku.originalPrice,
        stock: sku.stock,
        image: sku.image
      }))
    });

    if (isSubmit) {
      await review(id, { status: ProductStatus.PENDING, reviewedBy: user.userId });
    }

    revalidatePath("/merchant/products");
    revalidatePath(`/merchant/products/${id}/edit`);
    return {
      success: true,
      message: isSubmit ? "商品已提交审核" : "草稿已保存"
    };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
}

export async function toggleProductSaleStatusAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser("MERCHANT");
  if (!user.merchantId) throw new ValidationError("您还没有关联的店铺");

  const id = formData.get("id") as string;
  const saleStatus = formData.get("saleStatus") as ProductSaleStatus;

  await toggleSaleStatus(id, user.merchantId, saleStatus);
  revalidatePath("/merchant/products");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser("MERCHANT");
  if (!user.merchantId) throw new ValidationError("您还没有关联的店铺");

  const id = formData.get("id") as string;
  await deleteProduct(id, user.merchantId);
  revalidatePath("/merchant/products");
}
