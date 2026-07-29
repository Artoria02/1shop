import { redis } from "@/db";

export interface CartItem {
  skuId: string;
  productId: string;
  quantity: number;
  addedAt: string;
  selected: boolean;
}

function cartKey(userId: string): string {
  return `cart:${userId}`;
}

export async function getCart(userId: string): Promise<CartItem[]> {
  const raw = await redis.hgetall(cartKey(userId));
  const items: CartItem[] = [];
  for (const [, value] of Object.entries(raw)) {
    try {
      items.push(JSON.parse(value) as CartItem);
    } catch {
      // skip corrupted entries
    }
  }
  return items.sort(
    (a, b) =>
      new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
  );
}

export async function addItem(
  userId: string,
  skuId: string,
  productId: string,
  quantity: number
): Promise<void> {
  const key = cartKey(userId);
  const existing = await redis.hget(key, skuId);
  if (existing) {
    const item = JSON.parse(existing) as CartItem;
    item.quantity += quantity;
    await redis.hset(key, skuId, JSON.stringify(item));
  } else {
    const item: CartItem = {
      skuId,
      productId,
      quantity,
      addedAt: new Date().toISOString(),
      selected: true,
    };
    await redis.hset(key, skuId, JSON.stringify(item));
  }
}

export async function updateItem(
  userId: string,
  skuId: string,
  quantity: number
): Promise<void> {
  const key = cartKey(userId);
  const existing = await redis.hget(key, skuId);
  if (!existing) throw new Error("Cart item not found");
  const item = JSON.parse(existing) as CartItem;
  item.quantity = quantity;
  await redis.hset(key, skuId, JSON.stringify(item));
}

export async function removeItem(
  userId: string,
  skuId: string
): Promise<void> {
  await redis.hdel(cartKey(userId), skuId);
}

export async function toggleSelect(
  userId: string,
  skuId: string,
  selected: boolean
): Promise<void> {
  const key = cartKey(userId);
  const existing = await redis.hget(key, skuId);
  if (!existing) throw new Error("Cart item not found");
  const item = JSON.parse(existing) as CartItem;
  item.selected = selected;
  await redis.hset(key, skuId, JSON.stringify(item));
}

export async function selectAll(
  userId: string,
  selected: boolean
): Promise<void> {
  const key = cartKey(userId);
  const raw = await redis.hgetall(key);
  const updates: [string, string][] = [];
  for (const [skuId, value] of Object.entries(raw)) {
    const item = JSON.parse(value) as CartItem;
    item.selected = selected;
    updates.push([skuId, JSON.stringify(item)]);
  }
  if (updates.length > 0) {
    await redis.hset(key, ...updates.flat());
  }
}

export async function clearCart(userId: string): Promise<void> {
  await redis.del(cartKey(userId));
}

export async function removeSelectedItems(
  userId: string,
  skuIds: string[]
): Promise<void> {
  if (skuIds.length === 0) return;
  await redis.hdel(cartKey(userId), ...skuIds);
}
