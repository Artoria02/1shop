import { findById } from "@/server/services/product.service";
import { notFound } from "next/navigation";
import ProductDetailClient from "./product-detail-client";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let product;
  try {
    product = await findById(id);
  } catch {
    notFound();
  }

  // Only show approved and on-sale products to buyers
  if (product.status !== "APPROVED" || product.saleStatus !== "ON_SALE") {
    notFound();
  }

  const clientProduct = {
    id: product.id,
    name: product.name,
    subtitle: product.subtitle,
    description: product.description,
    mainImage: product.mainImage,
    images: product.images,
    specTemplate: product.specTemplate,
    merchant: product.merchant,
    skus: product.skus.map((sku) => ({
      id: sku.id,
      skuCode: sku.skuCode,
      specs: sku.specs as Record<string, string>,
      price: sku.price,
      originalPrice: sku.originalPrice,
      stock: sku.stock,
      image: sku.image
    }))
  };

  return <ProductDetailClient product={clientProduct} />;
}
