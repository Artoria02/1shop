import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================
// cart.service — 单元测试 (mock Redis)
// ============================================================

// Mock ioredis before importing the service
const mockRedisData: Record<string, string> = {};

const mockHgetall = vi.fn(async (key: string) => {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(mockRedisData)) {
    if (k.startsWith(key)) {
      // key is like "cart:user1", mock field directly
    }
    result[k] = v;
  }
  // Filter by key prefix: we store as hash fields, not top-level keys
  // Actually we need a hash-based mock. Let me redesign.
  return {};
});

// A simpler approach: mock at the module level inline

vi.mock("@/db", () => {
  // Hash-based storage for cart
  const hashStore = new Map<string, Map<string, string>>();

  function getHash(key: string): Map<string, string> {
    if (!hashStore.has(key)) {
      hashStore.set(key, new Map());
    }
    return hashStore.get(key)!;
  }

  return {
    redis: {
      hgetall: vi.fn(async (key: string) => {
        const hash = getHash(key);
        const result: Record<string, string> = {};
        for (const [field, value] of hash) {
          result[field] = value;
        }
        return result;
      }),
      hget: vi.fn(async (key: string, field: string) => {
        const hash = getHash(key);
        return hash.get(field) ?? null;
      }),
      hset: vi.fn(
        async (key: string, ...args: (string | Record<string, string>)[]) => {
          const hash = getHash(key);
          // hset can be called as hset(key, field, value) or hset(key, field1, val1, field2, val2, ...)
          // or hset(key, {field: value})
          if (args.length === 1 && typeof args[0] === "object") {
            const obj = args[0] as Record<string, string>;
            for (const [k, v] of Object.entries(obj)) {
              hash.set(k, v);
            }
          } else {
            for (let i = 0; i < args.length; i += 2) {
              const field = args[i] as string;
              const value = args[i + 1] as string;
              hash.set(field, value);
            }
          }
          return 1;
        }
      ),
      hdel: vi.fn(async (key: string, ...fields: string[]) => {
        const hash = getHash(key);
        let count = 0;
        for (const field of fields) {
          if (hash.delete(field)) count++;
        }
        return count;
      }),
      del: vi.fn(async (key: string) => {
        hashStore.delete(key);
        return 1;
      }),
      get: vi.fn(async (_key: string) => null),
      setex: vi.fn(async (_key: string, _ttl: number, _value: string) => "OK"),
    },
    prisma: {},
  };
});

import {
  getCart,
  addItem,
  updateItem,
  removeItem,
  toggleSelect,
  selectAll,
  clearCart,
  removeSelectedItems,
  type CartItem,
} from "../src/server/services/cart.service";

const USER_ID = "test-user-1";
const SKU_A = "sku-a";
const SKU_B = "sku-b";
const PRODUCT_X = "prod-x";
const PRODUCT_Y = "prod-y";

describe("cart.service — getCart", () => {
  beforeEach(async () => {
    await clearCart(USER_ID);
  });

  it("空购物车返回空数组", async () => {
    const items = await getCart(USER_ID);
    expect(items).toEqual([]);
  });

  it("返回已添加的商品并按 addedAt 排序", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 2);
    await new Promise((r) => setTimeout(r, 10)); // ensure different timestamps
    await addItem(USER_ID, SKU_B, PRODUCT_Y, 1);

    const items = await getCart(USER_ID);
    expect(items).toHaveLength(2);
    expect(items[0].skuId).toBe(SKU_A);
    expect(items[1].skuId).toBe(SKU_B);
  });
});

describe("cart.service — addItem", () => {
  beforeEach(async () => {
    await clearCart(USER_ID);
  });

  it("添加新商品到购物车", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 3);

    const items = await getCart(USER_ID);
    expect(items).toHaveLength(1);
    expect(items[0].skuId).toBe(SKU_A);
    expect(items[0].productId).toBe(PRODUCT_X);
    expect(items[0].quantity).toBe(3);
  });

  it("新添加的商品默认 selected=true", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);

    const items = await getCart(USER_ID);
    expect(items[0].selected).toBe(true);
  });

  it("新添加的商品有 addedAt 时间戳", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);

    const items = await getCart(USER_ID);
    expect(items[0].addedAt).toBeTruthy();
    expect(new Date(items[0].addedAt).getTime()).toBeGreaterThan(0);
  });

  it("已存在的 SKU 会累加数量", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 2);
    await addItem(USER_ID, SKU_A, PRODUCT_X, 3);

    const items = await getCart(USER_ID);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(5);
  });

  it("不同 SKU 独立存储", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);
    await addItem(USER_ID, SKU_B, PRODUCT_Y, 2);

    const items = await getCart(USER_ID);
    expect(items).toHaveLength(2);
  });

  it("库存单位为数字", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);
    const items = await getCart(USER_ID);
    expect(typeof items[0].quantity).toBe("number");
  });
});

describe("cart.service — updateItem", () => {
  beforeEach(async () => {
    await clearCart(USER_ID);
    await addItem(USER_ID, SKU_A, PRODUCT_X, 5);
  });

  it("更新已有商品数量", async () => {
    await updateItem(USER_ID, SKU_A, 10);

    const items = await getCart(USER_ID);
    expect(items[0].quantity).toBe(10);
  });

  it("更新不存在的商品抛出 Error", async () => {
    await expect(updateItem(USER_ID, "nonexistent", 5)).rejects.toThrow(
      "Cart item not found"
    );
  });

  it("更新数量为 1", async () => {
    await updateItem(USER_ID, SKU_A, 1);

    const items = await getCart(USER_ID);
    expect(items[0].quantity).toBe(1);
  });
});

describe("cart.service — removeItem", () => {
  beforeEach(async () => {
    await clearCart(USER_ID);
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);
    await addItem(USER_ID, SKU_B, PRODUCT_Y, 1);
  });

  it("移除已有商品", async () => {
    await removeItem(USER_ID, SKU_A);

    const items = await getCart(USER_ID);
    expect(items).toHaveLength(1);
    expect(items[0].skuId).toBe(SKU_B);
  });

  it("移除不存在的商品不报错", async () => {
    await expect(removeItem(USER_ID, "nonexistent")).resolves.toBeUndefined();
  });

  it("移除最后一个商品后购物车为空", async () => {
    await removeItem(USER_ID, SKU_A);
    await removeItem(USER_ID, SKU_B);

    const items = await getCart(USER_ID);
    expect(items).toEqual([]);
  });
});

describe("cart.service — toggleSelect", () => {
  beforeEach(async () => {
    await clearCart(USER_ID);
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);
  });

  it("切换为未选中", async () => {
    await toggleSelect(USER_ID, SKU_A, false);

    const items = await getCart(USER_ID);
    expect(items[0].selected).toBe(false);
  });

  it("切换为选中", async () => {
    // 先取消选中
    await toggleSelect(USER_ID, SKU_A, false);
    // 再选中
    await toggleSelect(USER_ID, SKU_A, true);

    const items = await getCart(USER_ID);
    expect(items[0].selected).toBe(true);
  });

  it("切换不存在的商品抛出 Error", async () => {
    await expect(
      toggleSelect(USER_ID, "nonexistent", false)
    ).rejects.toThrow("Cart item not found");
  });
});

describe("cart.service — selectAll", () => {
  beforeEach(async () => {
    await clearCart(USER_ID);
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);
    await addItem(USER_ID, SKU_B, PRODUCT_Y, 2);
  });

  it("全选", async () => {
    // 先把部分取消选中
    await toggleSelect(USER_ID, SKU_A, false);
    await selectAll(USER_ID, true);

    const items = await getCart(USER_ID);
    expect(items.every((i) => i.selected)).toBe(true);
  });

  it("取消全选", async () => {
    await selectAll(USER_ID, false);

    const items = await getCart(USER_ID);
    expect(items.every((i) => !i.selected)).toBe(true);
  });

  it("空购物车全选不报错", async () => {
    await clearCart(USER_ID);
    await expect(selectAll(USER_ID, true)).resolves.toBeUndefined();
  });
});

describe("cart.service — clearCart", () => {
  it("清空购物车", async () => {
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);
    await addItem(USER_ID, SKU_B, PRODUCT_Y, 1);

    await clearCart(USER_ID);

    const items = await getCart(USER_ID);
    expect(items).toEqual([]);
  });

  it("清空空购物车不报错", async () => {
    await expect(clearCart(USER_ID)).resolves.toBeUndefined();
  });
});

describe("cart.service — removeSelectedItems", () => {
  beforeEach(async () => {
    await clearCart(USER_ID);
    await addItem(USER_ID, SKU_A, PRODUCT_X, 1);
    await addItem(USER_ID, SKU_B, PRODUCT_Y, 2);
  });

  it("移除指定 SKU 列表的商品", async () => {
    await removeSelectedItems(USER_ID, [SKU_A]);

    const items = await getCart(USER_ID);
    expect(items).toHaveLength(1);
    expect(items[0].skuId).toBe(SKU_B);
  });

  it("移除全部 SKU", async () => {
    await removeSelectedItems(USER_ID, [SKU_A, SKU_B]);

    const items = await getCart(USER_ID);
    expect(items).toEqual([]);
  });

  it("空数组不执行任何操作", async () => {
    await expect(
      removeSelectedItems(USER_ID, [])
    ).resolves.toBeUndefined();

    const items = await getCart(USER_ID);
    expect(items).toHaveLength(2);
  });
});

describe("cart.service — 多用户隔离", () => {
  const USER_1 = "user-1";
  const USER_2 = "user-2";

  beforeEach(async () => {
    await clearCart(USER_1);
    await clearCart(USER_2);
  });

  it("不同用户购物车互不影响", async () => {
    await addItem(USER_1, SKU_A, PRODUCT_X, 3);
    await addItem(USER_2, SKU_B, PRODUCT_Y, 5);

    const cart1 = await getCart(USER_1);
    const cart2 = await getCart(USER_2);

    expect(cart1).toHaveLength(1);
    expect(cart1[0].skuId).toBe(SKU_A);
    expect(cart1[0].quantity).toBe(3);

    expect(cart2).toHaveLength(1);
    expect(cart2[0].skuId).toBe(SKU_B);
    expect(cart2[0].quantity).toBe(5);
  });

  it("清空一个用户不影响另一个", async () => {
    await addItem(USER_1, SKU_A, PRODUCT_X, 1);
    await addItem(USER_2, SKU_B, PRODUCT_Y, 1);

    await clearCart(USER_1);

    expect(await getCart(USER_1)).toEqual([]);
    expect(await getCart(USER_2)).toHaveLength(1);
  });
});
