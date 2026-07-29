import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCart } from "@/server/services/cart.service";
import { prisma } from "@/db";
import CartClient from "./cart-client";

export default async function CartPage() {
  const user = await getSessionUser("BUYER");
  if (!user) redirect("/index/login");

  const cartItems = await getCart(user.userId);

  // Enrich with product/SKU info
  const enriched: Array<{
    skuId: string;
    productId: string;
    name: string;
    image: string;
    specs: Record<string, string>;
    price: number;
    stock: number;
    quantity: number;
    selected: boolean;
    addedAt: string;
  }> = [];

  for (const item of cartItems) {
    const sku = await prisma.sku.findUnique({
      where: { id: item.skuId },
      include: { product: true },
    });
    if (!sku || sku.product.status !== "APPROVED" || sku.product.saleStatus !== "ON_SALE") continue;

    enriched.push({
      skuId: item.skuId,
      productId: item.productId,
      name: sku.product.name,
      image: sku.image ?? sku.product.mainImage,
      specs: sku.specs as Record<string, string>,
      price: sku.price,
      stock: sku.stock,
      quantity: item.quantity,
      selected: item.selected,
      addedAt: item.addedAt,
    });
  }

  return <CartClient items={enriched} />;
}
