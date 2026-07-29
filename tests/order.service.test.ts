import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/db";
import { ProductStatus, ProductSaleStatus, PaymentMethod } from "@prisma/client";
import { NotFoundError, ForbiddenError, ValidationError } from "../src/lib/errors";
import bcrypt from "bcryptjs";

// ============================================================
// Mock cart.service — order.service depends on it for Redis operations
// ============================================================

const mockGetCart = vi.fn();
const mockRemoveSelectedItems = vi.fn();

vi.mock("../src/server/services/cart.service", () => ({
  getCart: (...args: unknown[]) => mockGetCart(...args),
  removeSelectedItems: (...args: unknown[]) => mockRemoveSelectedItems(...args),
}));

import * as orderService from "../src/server/services/order.service";

// ============================================================
// 全局种子数据 — 整个测试文件共享
// ============================================================

let buyerId: string;
let merchantIdA: string;
let merchantIdB: string;
let categoryId: string;
let addressId: string;
let skuA1Id: string;
let skuA2Id: string;
let skuB1Id: string;
let productAId: string;
let productBId: string;

async function seedTestData() {
  // 创建买家
  const buyer = await prisma.user.create({
    data: {
      phone: `13999${Date.now().toString().slice(-6)}`,
      passwordHash: await bcrypt.hash("test123", 12),
      displayName: "测试买家",
      source: "SEED",
      merchantId: null,
    },
  });
  buyerId = buyer.id;

  // 创建类目
  const cat = await prisma.category.create({
    data: { name: "交易测试类目", sortOrder: 0, status: "ACTIVE" },
  });
  categoryId = cat.id;

  // 创建商家 A
  const merchantA = await prisma.merchant.create({
    data: {
      name: "店铺A",
      type: "ENTERPRISE",
      status: "APPROVED",
      contactName: "商家A",
      contactPhone: "13900000001",
      registerNo: `REG_A_${Date.now()}_1`,
    },
  });
  merchantIdA = merchantA.id;

  // 创建商家 B
  const merchantB = await prisma.merchant.create({
    data: {
      name: "店铺B",
      type: "INDIVIDUAL",
      status: "APPROVED",
      contactName: "商家B",
      contactPhone: "13900000002",
      registerNo: `REG_B_${Date.now()}_2`,
    },
  });
  merchantIdB = merchantB.id;

  // 创建收货地址
  const address = await prisma.shippingAddress.create({
    data: {
      userId: buyerId,
      receiverName: "张三",
      receiverPhone: "13900000003",
      province: "广东省",
      city: "深圳市",
      district: "南山区",
      detail: "科技园路1号",
      isDefault: true,
    },
  });
  addressId = address.id;

  // 创建商品 A（商家 A）
  const productA = await prisma.product.create({
    data: {
      merchantId: merchantIdA,
      name: "测试商品A",
      categoryId,
      mainImage: "/uploads/a.jpg",
      images: [],
      status: ProductStatus.APPROVED,
      saleStatus: ProductSaleStatus.ON_SALE,
    },
  });
  productAId = productA.id;

  // SKU A1（库存 100，价格 99元）
  const skuA1 = await prisma.sku.create({
    data: {
      productId: productAId,
      skuCode: "A-SKU-001",
      specs: { color: "红" },
      price: 9900,
      stock: 100,
      status: "ON_SALE",
    },
  });
  skuA1Id = skuA1.id;

  // SKU A2（库存 50，价格 199元）
  const skuA2 = await prisma.sku.create({
    data: {
      productId: productAId,
      skuCode: "A-SKU-002",
      specs: { color: "蓝" },
      price: 19900,
      stock: 50,
      status: "ON_SALE",
    },
  });
  skuA2Id = skuA2.id;

  // 创建商品 B（商家 B）
  const productB = await prisma.product.create({
    data: {
      merchantId: merchantIdB,
      name: "测试商品B",
      categoryId,
      mainImage: "/uploads/b.jpg",
      images: [],
      status: ProductStatus.APPROVED,
      saleStatus: ProductSaleStatus.ON_SALE,
    },
  });
  productBId = productB.id;

  // SKU B1（库存 30，价格 50元）
  const skuB1 = await prisma.sku.create({
    data: {
      productId: productBId,
      skuCode: "B-SKU-001",
      specs: { size: "L" },
      price: 5000,
      stock: 30,
      status: "ON_SALE",
    },
  });
  skuB1Id = skuB1.id;
}

async function cleanupAllOrders() {
  if (!buyerId) return;
  const orders = await prisma.order.findMany({
    where: { buyerId },
    select: { id: true },
  });
  for (const o of orders) {
    await prisma.payment.deleteMany({ where: { orderId: o.id } });
    const subs = await prisma.subOrder.findMany({
      where: { orderId: o.id },
      select: { id: true },
    });
    for (const s of subs) {
      await prisma.shipment.deleteMany({ where: { subOrderId: s.id } });
      await prisma.orderItem.deleteMany({ where: { subOrderId: s.id } });
    }
    await prisma.subOrder.deleteMany({ where: { orderId: o.id } });
  }
  await prisma.order.deleteMany({ where: { buyerId } });
}

async function cleanupTestData() {
  await cleanupAllOrders();
  if (buyerId) {
    await prisma.shippingAddress.deleteMany({ where: { userId: buyerId } });
    await prisma.user.deleteMany({ where: { id: buyerId } });
  }
  const productIds = [productAId, productBId].filter(Boolean);
  if (productIds.length > 0) {
    await prisma.sku.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  }
  const merchantIds = [merchantIdA, merchantIdB].filter(Boolean);
  if (merchantIds.length > 0) {
    await prisma.merchantStaff.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  }
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
}

// Helper: create a mock cart result for given skus
function mockCart(skus: { skuId: string; productId: string; quantity: number }[]) {
  mockGetCart.mockResolvedValue(
    skus.map((s) => ({
      skuId: s.skuId,
      productId: s.productId,
      quantity: s.quantity,
      addedAt: new Date().toISOString(),
      selected: true,
    }))
  );
  mockRemoveSelectedItems.mockResolvedValue(undefined);
}

// Seed once before all tests, cleanup once after all
beforeAll(async () => {
  await seedTestData();
});

afterAll(async () => {
  await cleanupTestData();
});

// Clean orders between each describe to keep state clean
afterEach(async () => {
  vi.clearAllMocks();
});

// ============================================================
// createOrder 测试
// ============================================================

describe("order.service — createOrder", () => {
  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("创建订单 — 单商家单商品，正确拆单", async () => {
    mockCart([{ skuId: skuA1Id, productId: productAId, quantity: 2 }]);

    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });

    expect(order.id).toBeTruthy();
    expect(order.orderNo).toMatch(/^\d{20}$/);
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.buyerId).toBe(buyerId);
    expect(order.totalAmount).toBe(19800); // 2 * 9900
    expect(order.expireAt).toBeTruthy();

    expect(order.subOrders).toHaveLength(1);
    const sub = order.subOrders[0];
    expect(sub.merchantId).toBe(merchantIdA);
    expect(sub.merchantName).toBe("店铺A");
    expect(sub.totalAmount).toBe(19800);
    expect(sub.status).toBe("PENDING_PAYMENT");
    expect(sub.items).toHaveLength(1);
    expect(sub.items[0].productName).toBe("测试商品A");
    expect(sub.items[0].skuCode).toBe("A-SKU-001");
    expect(sub.items[0].price).toBe(9900);
    expect(sub.items[0].quantity).toBe(2);
    expect(sub.items[0].amount).toBe(19800);

    const snapshot = order.addressSnapshot as Record<string, unknown>;
    expect(snapshot.receiverName).toBe("张三");
    expect(snapshot.province).toBe("广东省");
  });

  it("创建订单 — 库存正确扣减", async () => {
    const skuBefore = await prisma.sku.findUnique({ where: { id: skuA2Id } });
    const stockBefore = skuBefore!.stock;

    mockCart([{ skuId: skuA2Id, productId: productAId, quantity: 3 }]);

    await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA2Id],
      addressId,
      paymentMethod: PaymentMethod.ALIPAY,
    });

    const skuAfter = await prisma.sku.findUnique({ where: { id: skuA2Id } });
    expect(skuAfter!.stock).toBe(stockBefore - 3);
  });

  it("创建订单 — 多商家商品正确拆为多个子订单", async () => {
    mockCart([
      { skuId: skuA1Id, productId: productAId, quantity: 1 },
      { skuId: skuB1Id, productId: productBId, quantity: 2 },
    ]);

    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id, skuB1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });

    expect(order.subOrders).toHaveLength(2);
    const subA = order.subOrders.find((s) => s.merchantId === merchantIdA);
    const subB = order.subOrders.find((s) => s.merchantId === merchantIdB);
    expect(subA).toBeTruthy();
    expect(subB).toBeTruthy();
    expect(subA!.merchantName).toBe("店铺A");
    expect(subB!.merchantName).toBe("店铺B");
    expect(order.totalAmount).toBe(9900 * 1 + 5000 * 2);
  });

  it("创建订单 — 同一商家多个 SKU 合并为一个子订单", async () => {
    mockCart([
      { skuId: skuA1Id, productId: productAId, quantity: 1 },
      { skuId: skuA2Id, productId: productAId, quantity: 1 },
    ]);

    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id, skuA2Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });

    expect(order.subOrders).toHaveLength(1);
    expect(order.subOrders[0].items).toHaveLength(2);
    expect(order.totalAmount).toBe(9900 + 19900);
  });

  it("创建订单 — 购物车无选中商品时抛出 ValidationError", async () => {
    mockGetCart.mockResolvedValue([]);
    await expect(
      orderService.createOrder({
        userId: buyerId,
        skuIds: [skuA1Id],
        addressId,
        paymentMethod: PaymentMethod.WECHAT_PAY,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("创建订单 — 购物车 SKU 未选中时被过滤", async () => {
    mockGetCart.mockResolvedValue([
      {
        skuId: skuA1Id,
        productId: productAId,
        quantity: 1,
        addedAt: new Date().toISOString(),
        selected: false,
      },
    ]);
    await expect(
      orderService.createOrder({
        userId: buyerId,
        skuIds: [skuA1Id],
        addressId,
        paymentMethod: PaymentMethod.WECHAT_PAY,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("创建订单 — 库存不足时抛出 ValidationError", async () => {
    mockCart([{ skuId: skuB1Id, productId: productBId, quantity: 999 }]);
    await expect(
      orderService.createOrder({
        userId: buyerId,
        skuIds: [skuB1Id],
        addressId,
        paymentMethod: PaymentMethod.WECHAT_PAY,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("创建订单 — 地址不存在时抛出 NotFoundError", async () => {
    mockCart([{ skuId: skuA1Id, productId: productAId, quantity: 1 }]);
    await expect(
      orderService.createOrder({
        userId: buyerId,
        skuIds: [skuA1Id],
        addressId: "non-existent-address-id",
        paymentMethod: PaymentMethod.WECHAT_PAY,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("创建订单 — 下单后清除购物车选中商品", async () => {
    mockCart([{ skuId: skuA1Id, productId: productAId, quantity: 1 }]);
    await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    expect(mockRemoveSelectedItems).toHaveBeenCalledWith(buyerId, [skuA1Id]);
  });
});

// ============================================================
// findOrderById 测试
// ============================================================

describe("order.service — findOrderById", () => {
  let orderId: string;

  beforeAll(async () => {
    mockCart([{ skuId: skuA1Id, productId: productAId, quantity: 1 }]);
    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("根据 ID 查询订单，包含关联数据", async () => {
    const order = await orderService.findOrderById(orderId);
    expect(order.id).toBe(orderId);
    expect(order.subOrders).toBeDefined();
    expect(order.subOrders.length).toBeGreaterThan(0);
    expect(order.subOrders[0].items).toBeDefined();
  });

  it("不存在的订单抛出 NotFoundError", async () => {
    await expect(
      orderService.findOrderById("non-existent")
    ).rejects.toThrow(NotFoundError);
  });
});

// ============================================================
// findOrdersByBuyer 测试
// ============================================================

describe("order.service — findOrdersByBuyer", () => {
  beforeAll(async () => {
    mockCart([{ skuId: skuA1Id, productId: productAId, quantity: 2 }]);
    await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("返回买家的订单列表，支持分页", async () => {
    const result = await orderService.findOrdersByBuyer(buyerId, {
      page: 1,
      pageSize: 10,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.items.every((o) => o.buyerId === buyerId)).toBe(true);
  });

  it("按状态筛选", async () => {
    const result = await orderService.findOrdersByBuyer(buyerId, {
      status: "PENDING_PAYMENT",
    });
    if (result.total > 0) {
      expect(result.items.every((o) => o.status === "PENDING_PAYMENT")).toBe(true);
    }
  });

  it("其他买家查不到该买家的订单", async () => {
    const result = await orderService.findOrdersByBuyer("non-existent-user");
    expect(result.total).toBe(0);
  });
});

// ============================================================
// findSubOrdersByMerchant 测试
// ============================================================

describe("order.service — findSubOrdersByMerchant", () => {
  beforeAll(async () => {
    mockCart([
      { skuId: skuA1Id, productId: productAId, quantity: 1 },
      { skuId: skuB1Id, productId: productBId, quantity: 1 },
    ]);
    await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id, skuB1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("商家 A 只能看到自己的子订单", async () => {
    const result = await orderService.findSubOrdersByMerchant(merchantIdA, {
      page: 1,
      pageSize: 10,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.every((s) => s.merchantId === merchantIdA)).toBe(true);
  });

  it("商家 B 不能看到商家 A 的子订单", async () => {
    const resultA = await orderService.findSubOrdersByMerchant(merchantIdA);
    expect(resultA.total).toBeGreaterThanOrEqual(1);

    const resultB = await orderService.findSubOrdersByMerchant(merchantIdB);
    const bSubOrderIds = resultB.items.map((s) => s.id);
    const aSubOrderIds = resultA.items.map((s) => s.id);
    const overlap = bSubOrderIds.filter((id) => aSubOrderIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("按子订单号搜索不存在的订单返回空", async () => {
    const result = await orderService.findSubOrdersByMerchant(merchantIdA, {
      search: "nonexistent_order_no_xyz",
    });
    expect(result.items).toHaveLength(0);
  });
});

// ============================================================
// cancelOrder 测试
// ============================================================

describe("order.service — cancelOrder", () => {
  let orderId: string;
  let stockBeforeCancel: number;

  beforeAll(async () => {
    const sku = await prisma.sku.findUnique({ where: { id: skuA1Id } });
    stockBeforeCancel = sku!.stock;

    mockCart([{ skuId: skuA1Id, productId: productAId, quantity: 1 }]);
    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("买家取消订单 — PENDING_PAYMENT → CANCELLED", async () => {
    const cancelled = await orderService.cancelOrder(orderId, buyerId, "不想要了");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBeTruthy();
    expect(cancelled.cancelReason).toBe("不想要了");
    expect(cancelled.subOrders.every((s) => s.status === "CANCELLED")).toBe(true);
  });

  it("取消后库存恢复", async () => {
    const skuAfter = await prisma.sku.findUnique({ where: { id: skuA1Id } });
    expect(skuAfter!.stock).toBe(stockBeforeCancel);
  });

  it("非买家本人取消失败", async () => {
    await expect(
      orderService.cancelOrder(orderId, "wrong-user-id", "test")
    ).rejects.toThrow(ForbiddenError);
  });

  it("已取消的订单不可再取消", async () => {
    await expect(
      orderService.cancelOrder(orderId, buyerId, "二次取消")
    ).rejects.toThrow();
  });

  it("不存在的订单取消失败", async () => {
    await expect(
      orderService.cancelOrder("non-existent", buyerId)
    ).rejects.toThrow(NotFoundError);
  });
});

// ============================================================
// confirmReceipt 测试
// ============================================================

describe("order.service — confirmReceipt", () => {
  let subOrderId: string;
  let orderIdForReceipt: string;

  beforeAll(async () => {
    mockCart([{ skuId: skuA2Id, productId: productAId, quantity: 1 }]);
    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA2Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    orderIdForReceipt = order.id;
    subOrderId = order.subOrders[0].id;

    // 模拟支付成功 → 发货
    await prisma.order.update({
      where: { id: orderIdForReceipt },
      data: { status: "PAID", paidAt: new Date() },
    });
    await prisma.subOrder.update({
      where: { id: subOrderId },
      data: { status: "SHIPPED", shippedAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("确认收货 — SHIPPED → RECEIVED", async () => {
    const updated = await orderService.confirmReceipt(subOrderId, buyerId);
    expect(updated.status).toBe("RECEIVED");
    expect(updated.receivedAt).toBeTruthy();
  });

  it("非买家本人确认失败", async () => {
    await expect(
      orderService.confirmReceipt(subOrderId, "wrong-user")
    ).rejects.toThrow(ForbiddenError);
  });

  it("不存在的子订单确认失败", async () => {
    await expect(
      orderService.confirmReceipt("non-existent", buyerId)
    ).rejects.toThrow(NotFoundError);
  });
});

// ============================================================
// completeOrder 测试
// ============================================================

describe("order.service — completeOrder", () => {
  let orderToComplete: string;

  beforeAll(async () => {
    mockCart([{ skuId: skuB1Id, productId: productBId, quantity: 1 }]);
    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuB1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    orderToComplete = order.id;

    // 流转到 RECEIVED
    await prisma.order.update({
      where: { id: orderToComplete },
      data: { status: "RECEIVED", paidAt: new Date() },
    });
    await prisma.subOrder.updateMany({
      where: { orderId: orderToComplete },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("完成订单 — RECEIVED → COMPLETED", async () => {
    await orderService.completeOrder(orderToComplete);

    const order = await prisma.order.findUnique({ where: { id: orderToComplete } });
    expect(order!.status).toBe("COMPLETED");
    expect(order!.completedAt).toBeTruthy();

    const subs = await prisma.subOrder.findMany({ where: { orderId: orderToComplete } });
    expect(subs.every((s) => s.status === "COMPLETED")).toBe(true);
  });

  it("已完成订单不可再完成", async () => {
    await expect(orderService.completeOrder(orderToComplete)).rejects.toThrow();
  });

  it("不存在的订单完成失败", async () => {
    await expect(
      orderService.completeOrder("non-existent")
    ).rejects.toThrow(NotFoundError);
  });
});

// ============================================================
// timeoutCancel 测试
// ============================================================

describe("order.service — timeoutCancel", () => {
  let expiredOrderId: string;
  let notExpiredOrderId: string;

  beforeAll(async () => {
    // Expired order
    mockCart([{ skuId: skuB1Id, productId: productBId, quantity: 1 }]);
    const expiredOrder = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuB1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    expiredOrderId = expiredOrder.id;
    await prisma.order.update({
      where: { id: expiredOrderId },
      data: { expireAt: new Date(Date.now() - 60 * 1000) },
    });

    // Fresh order
    mockCart([{ skuId: skuA1Id, productId: productAId, quantity: 1 }]);
    const freshOrder = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA1Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    notExpiredOrderId = freshOrder.id;
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("超时订单自动取消 — PENDING_PAYMENT → CANCELLED", async () => {
    await orderService.timeoutCancel(expiredOrderId);

    const order = await prisma.order.findUnique({ where: { id: expiredOrderId } });
    expect(order!.status).toBe("CANCELLED");
    expect(order!.cancelReason).toBe("Payment timeout");
  });

  it("未过期订单不会被取消", async () => {
    await orderService.timeoutCancel(notExpiredOrderId);

    const order = await prisma.order.findUnique({ where: { id: notExpiredOrderId } });
    expect(order!.status).toBe("PENDING_PAYMENT");
  });

  it("非 PENDING_PAYMENT 订单不会被超时取消", async () => {
    // expiredOrderId is already CANCELLED, calling again should be no-op
    await expect(orderService.timeoutCancel(expiredOrderId)).resolves.toBeUndefined();
  });
});

// ============================================================
// 金额整数分校验
// ============================================================

describe("order.service — 金额整数分校验", () => {
  beforeAll(async () => {
    mockCart([{ skuId: skuA2Id, productId: productAId, quantity: 3 }]);
    await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuA2Id],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
  });

  afterAll(async () => {
    await cleanupAllOrders();
  });

  it("所有金额均为整数", async () => {
    const orders = await orderService.findOrdersByBuyer(buyerId);
    for (const order of orders.items) {
      expect(Number.isInteger(order.totalAmount)).toBe(true);
      for (const sub of order.subOrders) {
        expect(Number.isInteger(sub.totalAmount)).toBe(true);
        for (const item of sub.items) {
          expect(Number.isInteger(item.price)).toBe(true);
          expect(Number.isInteger(item.amount)).toBe(true);
          expect(item.amount).toBe(item.price * item.quantity);
        }
      }
    }
  });
});
