import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/db";
import { PaymentMethod, ProductStatus, ProductSaleStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "../src/lib/errors";
import bcrypt from "bcryptjs";

// ============================================================
// Mock dependencies
// ============================================================

const mockGetCart = vi.fn();
const mockRemoveSelectedItems = vi.fn();

vi.mock("../src/server/services/cart.service", () => ({
  getCart: (...args: unknown[]) => mockGetCart(...args),
  removeSelectedItems: (...args: unknown[]) => mockRemoveSelectedItems(...args),
}));

// Mock Redis — used by payment.service for idempotency
const redisStore = new Map<string, string>();

vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("../src/db")>("../src/db");
  return {
    ...actual,
    redis: {
      get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
      setex: vi.fn(async (key: string, _ttl: number, value: string) => {
        redisStore.set(key, value);
        return "OK";
      }),
    },
  };
});

import * as orderService from "../src/server/services/order.service";
import * as paymentService from "../src/server/services/payment.service";

// ============================================================
// 全局种子数据
// ============================================================

let buyerId: string;
let merchantId: string;
let categoryId: string;
let addressId: string;
let skuId: string;
let productId: string;
let orderId: string;
let orderNo: string;

async function seedTestData() {
  const buyer = await prisma.user.create({
    data: {
      phone: `13998${Date.now().toString().slice(-6)}`,
      passwordHash: await bcrypt.hash("test123", 12),
      displayName: "支付测试买家",
      source: "SEED",
      merchantId: null,
    },
  });
  buyerId = buyer.id;

  const cat = await prisma.category.create({
    data: { name: "支付测试类目", sortOrder: 0, status: "ACTIVE" },
  });
  categoryId = cat.id;

  const merchant = await prisma.merchant.create({
    data: {
      name: "支付测试店铺",
      type: "ENTERPRISE",
      status: "APPROVED",
      contactName: "掌柜",
      contactPhone: "13900000005",
      registerNo: `REG_PAY_${Date.now()}`,
    },
  });
  merchantId = merchant.id;

  const addr = await prisma.shippingAddress.create({
    data: {
      userId: buyerId,
      receiverName: "李四",
      receiverPhone: "13900000006",
      province: "北京市",
      city: "北京市",
      district: "朝阳区",
      detail: "望京路1号",
      isDefault: true,
    },
  });
  addressId = addr.id;

  const product = await prisma.product.create({
    data: {
      merchantId,
      name: "支付测试商品",
      categoryId,
      mainImage: "/uploads/pay-test.jpg",
      images: [],
      status: ProductStatus.APPROVED,
      saleStatus: ProductSaleStatus.ON_SALE,
    },
  });
  productId = product.id;

  const sku = await prisma.sku.create({
    data: {
      productId,
      skuCode: "PAY-TEST-001",
      specs: { color: "金" },
      price: 29900,
      stock: 200,
      status: "ON_SALE",
    },
  });
  skuId = sku.id;
}

async function cleanupTestData() {
  if (buyerId) {
    const orders = await prisma.order.findMany({ where: { buyerId }, select: { id: true } });
    for (const o of orders) {
      await prisma.payment.deleteMany({ where: { orderId: o.id } });
      const subs = await prisma.subOrder.findMany({ where: { orderId: o.id }, select: { id: true } });
      for (const s of subs) {
        await prisma.shipment.deleteMany({ where: { subOrderId: s.id } });
        await prisma.orderItem.deleteMany({ where: { subOrderId: s.id } });
      }
      await prisma.subOrder.deleteMany({ where: { orderId: o.id } });
    }
    await prisma.order.deleteMany({ where: { buyerId } });
    await prisma.shippingAddress.deleteMany({ where: { userId: buyerId } });
    await prisma.user.deleteMany({ where: { id: buyerId } });
  }
  if (productId) {
    await prisma.sku.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  if (merchantId) await prisma.merchant.deleteMany({ where: { id: merchantId } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
  redisStore.clear();
}

function mockCartForSku() {
  mockGetCart.mockResolvedValue([
    {
      skuId,
      productId,
      quantity: 1,
      addedAt: new Date().toISOString(),
      selected: true,
    },
  ]);
  mockRemoveSelectedItems.mockResolvedValue(undefined);
}

// Seed once, cleanup once
beforeAll(async () => {
  await seedTestData();
});

afterAll(async () => {
  await cleanupTestData();
});

// ============================================================
// createPayment 测试
// ============================================================

describe("payment.service — createPayment", () => {
  beforeAll(async () => {
    mockCartForSku();
    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuId],
      addressId,
      paymentMethod: PaymentMethod.WECHAT_PAY,
    });
    orderId = order.id;
    orderNo = order.orderNo;
  });

  it("创建支付单 — 返回 payUrl 和支付信息", async () => {
    const payment = await paymentService.createPayment(orderId, PaymentMethod.WECHAT_PAY);

    expect(payment.id).toBeTruthy();
    expect(payment.orderNo).toBe(orderNo);
    expect(payment.amount).toBe(29900);
    expect(payment.status).toBe("PENDING");
    expect(payment.method).toBe("WECHAT_PAY");
    expect(payment.payUrl).toContain("/api/payment/mock-pay?paymentId=");
  });

  it("重复创建支付单返回已有支付单（幂等）", async () => {
    const first = await paymentService.createPayment(orderId, PaymentMethod.WECHAT_PAY);
    const second = await paymentService.createPayment(orderId, PaymentMethod.WECHAT_PAY);
    expect(second.id).toBe(first.id);
    expect(second.payUrl).toBe(first.payUrl);
  });

  it("订单不存在时创建支付单失败", async () => {
    await expect(
      paymentService.createPayment("non-existent", PaymentMethod.ALIPAY)
    ).rejects.toThrow(NotFoundError);
  });

  it("已取消的订单不可创建支付单", async () => {
    // Cancel the order first
    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    await expect(
      paymentService.createPayment(orderId, PaymentMethod.WECHAT_PAY)
    ).rejects.toThrow(ValidationError);
    // Restore
    await prisma.order.update({ where: { id: orderId }, data: { status: "PENDING_PAYMENT" } });
  });

  it("支持支付宝支付方式", async () => {
    mockCartForSku();
    const order = await orderService.createOrder({
      userId: buyerId,
      skuIds: [skuId],
      addressId,
      paymentMethod: PaymentMethod.ALIPAY,
    });
    const payment = await paymentService.createPayment(order.id, PaymentMethod.ALIPAY);
    expect(payment.method).toBe("ALIPAY");
  });
});

// ============================================================
// handleCallback 测试
// ============================================================

describe("payment.service — handleCallback", () => {
  let paymentId: string;
  let idempotencyKey: string;

  beforeAll(async () => {
    // Ensure order is PENDING_PAYMENT and has a payment record
    await prisma.order.update({ where: { id: orderId }, data: { status: "PENDING_PAYMENT" } });

    // Delete any existing payment records for this order
    await prisma.payment.deleteMany({ where: { orderId } });

    const payment = await paymentService.createPayment(orderId, PaymentMethod.WECHAT_PAY);
    paymentId = payment.id;

    const dbPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
    idempotencyKey = dbPayment!.idempotencyKey;
  });

  beforeEach(() => {
    redisStore.clear();
  });

  it("支付回调成功 — 更新支付单和订单状态为 PAID", async () => {
    const result = await paymentService.handleCallback(
      idempotencyKey,
      "TXN-20260605-001",
      { sign: "mock-sign" }
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment!.status).toBe("PAID");
    expect(payment!.transactionId).toBe("TXN-20260605-001");
    expect(payment!.paidAt).toBeTruthy();

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order!.status).toBe("PAID");
    expect(order!.paidAt).toBeTruthy();

    const subs = await prisma.subOrder.findMany({ where: { orderId } });
    expect(subs.every((s) => s.status === "PAID")).toBe(true);
  });

  it("重复回调幂等处理 — 返回 duplicate=true", async () => {
    // Second callback with same idempotency key (Redis cache should have it)
    const result = await paymentService.handleCallback(
      idempotencyKey,
      "TXN-001",
      { sign: "mock" }
    );
    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
  });

  it("Redis 幂等键阻止重复处理", async () => {
    // Pre-set the idempotency key in Redis
    redisStore.set(`idem:payment:some-key`, "processed");

    const result = await paymentService.handleCallback(
      "some-key",
      "TXN-002",
      { sign: "mock" }
    );
    expect(result.duplicate).toBe(true);
  });

  it("不存在的幂等键回调失败", async () => {
    await expect(
      paymentService.handleCallback("nonexistent-key", "TXN-XXX", { sign: "mock" })
    ).rejects.toThrow(NotFoundError);
  });
});

// ============================================================
// findByOrderId 测试
// ============================================================

describe("payment.service — findByOrderId", () => {
  it("查询已有支付单", async () => {
    const payment = await paymentService.findByOrderId(orderId);
    expect(payment).toBeTruthy();
    expect(payment.orderId).toBe(orderId);
  });

  it("不存在的支付单抛出 NotFoundError", async () => {
    await expect(paymentService.findByOrderId("non-existent")).rejects.toThrow(NotFoundError);
  });
});
