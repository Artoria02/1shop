import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCart } from "@/server/services/cart.service";
import { prisma } from "@/db";
import CheckoutClient from "./checkout-client";

interface SelectedItem {
  skuId: string;
  quantity: number;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ skuIds?: string; direct?: string }>;
}) {
  const user = await getSessionUser("BUYER");
  if (!user) redirect("/index/login");

  const params = await searchParams;
  const skuIds = params.skuIds?.split(",") ?? [];
  const isDirect = params.direct === "1";

  if (skuIds.length === 0) redirect("/cart");

  let selectedItems: SelectedItem[];

  if (isDirect) {
    // 直接购买模式：不经过购物车，直接生成结算项
    selectedItems = skuIds.map((skuId) => ({ skuId, quantity: 1 }));
  } else {
    // 购物车模式：从 Redis 购物车读取已选中项
    const cartItems = await getCart(user.userId);
    selectedItems = cartItems
      .filter((i) => skuIds.includes(i.skuId) && i.selected)
      .map((i) => ({ skuId: i.skuId, quantity: i.quantity }));
  }

  if (selectedItems.length === 0) redirect("/cart");

  // Enrich items
  const enriched: Array<{
    skuId: string;
    productId: string;
    name: string;
    image: string;
    specs: Record<string, string>;
    price: number;
    quantity: number;
    merchantName: string;
  }> = [];

  for (const item of selectedItems) {
    const sku = await prisma.sku.findUnique({
      where: { id: item.skuId },
      include: { product: { include: { merchant: true } } },
    });
    if (!sku) continue;
    enriched.push({
      skuId: item.skuId,
      productId: sku.productId,
      name: sku.product.name,
      image: sku.image ?? sku.product.mainImage,
      specs: sku.specs as Record<string, string>,
      price: sku.price,
      quantity: item.quantity,
      merchantName: sku.product.merchant.name,
    });
  }

  // Group by merchant
  const groups = new Map<
    string,
    { merchantName: string; items: typeof enriched; subtotal: number }
  >();
  for (const item of enriched) {
    if (!groups.has(item.merchantName)) {
      groups.set(item.merchantName, {
        merchantName: item.merchantName,
        items: [],
        subtotal: 0,
      });
    }
    const g = groups.get(item.merchantName)!;
    g.items.push(item);
    g.subtotal += item.price * item.quantity;
  }

  const totalAmount = enriched.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  // Get addresses
  const addresses = await prisma.shippingAddress.findMany({
    where: { userId: user.userId },
    orderBy: { isDefault: "desc" },
  });

  return (
    <CheckoutClient
      groups={Array.from(groups.values())}
      totalAmount={totalAmount}
      addresses={addresses.map((a) => ({
        id: a.id,
        receiverName: a.receiverName,
        receiverPhone: a.receiverPhone,
        fullAddress: `${a.province}${a.city}${a.district} ${a.detail}`,
        isDefault: a.isDefault,
      }))}
      skuIds={skuIds}
      isDirect={isDirect}
    />
  );
}
