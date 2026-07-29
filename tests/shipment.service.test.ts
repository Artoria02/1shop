import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/db";
import { PaymentMethod, ProductStatus, ProductSaleStatus } from "@prisma/client";
import { NotFoundError, ForbiddenError } from "../src/lib/errors";
import bcrypt from "bcryptjs";

// ============================================================
// Mock cart.service (needed for order creation)
// ============================================================

const mockGetCart = vi.fn();
const mockRemoveSelectedItems = vi.fn();

vi.mock("../src/server/services/cart.service", () => ({
  getCart: (...args: unknown[]) => mockGetCart(...args),
  removeSelectedItems: (...args: unknown[]) => mockRemoveSelectedItems(...args),
}));

import * as orderService from "../src/server/services/order.service";
import * as shipmentService from "../src/server/services/shipment.service";

// ============================================================
// 全局种子数据
// ============================================================

let buyerId: string;
let merchantIdA: string;
let merchantIdB: string;
let categoryId: string;
let addressId: string;
let skuAId: string;
let skuBId: string;
let productAId: string;
let productBId: string;
let subOrderAId: string;
let subOrderBId: string;

async function seedTestData() {
  const buyer = await prisma.user.create({
    data: {
      phone: `13997${Date.now().toString().slice(-6)}`,
      passwordHash: await bcrypt.hash("test123", 12),
      displayName: "发货测试买家",
      source: "SEED",
      merchantId: null,
    },
  });
  buyerId = buyer.id;

  const cat = await prisma.category.create({
    data: { name: "发货测试类目", sortOrder: 0, status: "ACTIVE" },
  });
  categoryId = cat.id;

  const merchantA = await prisma.merchant.create({
    data: {
      name: "发货店铺A",
      type: "ENTERPRISE",
      status: "APPROVED",
      contactName: "商家A",
      contactPhone: "13900000011",
      registerNo: `REG_SHIP_A_${Date.now()}`,
    },
  });
  merchantIdA = merchantA.id;

  const merchantB = await prisma.merchant.create({
    data: {
      name: "发货店铺B",
      type: "INDIVIDUAL",
      status: "APPROVED",
      contactName: "商家B",
      contactPhone: "13900000012",
      registerNo: `REG_SHIP_B_${Date.now()}`,
    },
  });
  merchantIdB = merchantB.id;

  const addr = await prisma.shippingAddress.create({
    data: {
      userId: buyerId,
      receiverName: "王五",
      receiverPhone: "13900000013",
      province: "上海市",
      city: "上海市",
      district: "浦东新区",
      detail: "陆家嘴金融城1号",
      isDefault: true,
    },
  });
  addressId = addr.id;

  const productA = await prisma.product.create({
    data: {
      merchantId: merchantIdA,
      name: "发货测试商品A",
      categoryId,
      mainImage: "/uploads/ship-a.jpg",
      images: [],
      status: ProductStatus.APPROVED,
      saleStatus: ProductSaleStatus.ON_SALE,
    },
  });
  productAId = productA.id;

  const skuA = await prisma.sku.create({
    data: {
      productId: productAId,
      skuCode: "SHIP-A-001",
      specs: { color: "白" },
      price: 19900,
      stock: 100,
      status: "ON_SALE",
    },
  });
  skuAId = skuA.id;

  const productB = await prisma.product.create({
    data: {
      merchantId: merchantIdB,
      name: "发货测试商品B",
      categoryId,
      mainImage: "/uploads/ship-b.jpg",
      images: [],
      status: ProductStatus.APPROVED,
      saleStatus: ProductSaleStatus.ON_SALE,
    },
  });
  productBId = productB.id;

  const skuB = await prisma.sku.create({
    data: {
      productId: productBId,
      skuCode: "SHIP-B-001",
      specs: { size: "XL" },
      price: 9900,
      stock: 50,
      status: "ON_SALE",
    },
  });
  skuBId = skuB.id;
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

beforeAll(async () => {
  await seedTestData();
});

afterAll(async () => {
  await cleanupTestData();
});

// ============================================================
// 创建多商家订单（在所有测试之前）
// ============================================================

async function createMultiMerchantOrder() {
  mockGetCart.mockResolvedValue([
    {
      skuId: skuAId,
      productId: productAId,
      quantity: 2,
      addedAt: new Date().toISOString(),
      selected: true,
    },
    {
      skuId: skuBId,
      productId: productBId,
      quantity: 3,
      addedAt: new Date().toISOString(),
      selected: true,
    },
  ]);
  mockRemoveSelectedItems.mockResolvedValue(undefined);

  const order = await orderService.createOrder({
    userId: buyerId,
    skuIds: [skuAId, skuBId],
    addressId,
    paymentMethod: PaymentMethod.WECHAT_PAY,
  });

  for (const sub of order.subOrders) {
    if (sub.merchantId === merchantIdA) subOrderAId = sub.id;
    if (sub.merchantId === merchantIdB) subOrderBId = sub.id;
  }

  // Set order to PAID so it can be shipped
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID", paidAt: new Date() },
  });
  await prisma.subOrder.updateMany({
    where: { orderId: order.id },
    data: { status: "PAID", paidAt: new Date() },
  });
}

// ============================================================
// createShipment 测试
// ============================================================

describe("shipment.service — createShipment", () => {
  beforeAll(async () => {
    await createMultiMerchantOrder();
  });

  it("商家发货 — PAID → SHIPPED，创建物流记录", async () => {
    const shipment = await shipmentService.createShipment(
      subOrderAId,
      merchantIdA,
      "顺丰速运",
      "SF1234567890"
    );

    expect(shipment.id).toBeTruthy();
    expect(shipment.subOrderId).toBe(subOrderAId);
    expect(shipment.carrier).toBe("顺丰速运");
    expect(shipment.trackingNo).toBe("SF1234567890");
    expect(shipment.status).toBe("SHIPPED");
    expect(shipment.shippedAt).toBeTruthy();

    const sub = await prisma.subOrder.findUnique({ where: { id: subOrderAId } });
    expect(sub!.status).toBe("SHIPPED");
    expect(sub!.shippedAt).toBeTruthy();
  });

  it("重复发货被拒绝（状态机阻止 SHIPPED → SHIPPED）", async () => {
    // subOrderAId is already SHIPPED, state machine rejects the transition
    await expect(
      shipmentService.createShipment(subOrderAId, merchantIdA, "圆通速递", "YT9876543210")
    ).rejects.toThrow();
  });

  it("商家不能给其他商家的子订单发货", async () => {
    await expect(
      shipmentService.createShipment(subOrderBId, merchantIdA, "中通快递", "ZT1111111111")
    ).rejects.toThrow(ForbiddenError);
  });

  it("非 PAID 状态的子订单不能发货", async () => {
    // Temporarily set subOrderBId to CANCELLED
    await prisma.subOrder.update({
      where: { id: subOrderBId },
      data: { status: "CANCELLED" },
    });

    await expect(
      shipmentService.createShipment(subOrderBId, merchantIdB, "韵达快递", "YD2222222222")
    ).rejects.toThrow();

    // Restore
    await prisma.subOrder.update({
      where: { id: subOrderBId },
      data: { status: "PAID" },
    });
  });

  it("不存在的子订单发货失败", async () => {
    await expect(
      shipmentService.createShipment("non-existent", merchantIdA, "顺丰", "SF000")
    ).rejects.toThrow(NotFoundError);
  });

  it("所有子订单发货后，主订单状态同步为 SHIPPED", async () => {
    // Ship subOrderBId
    await shipmentService.createShipment(
      subOrderBId,
      merchantIdB,
      "圆通速递",
      "YT9999999999"
    );

    // Check master order
    const subA = await prisma.subOrder.findUnique({ where: { id: subOrderAId } });
    const order = await prisma.order.findUnique({ where: { id: subA!.orderId } });
    expect(order!.status).toBe("SHIPPED");
  });
});

// ============================================================
// findBySubOrderId 测试
// ============================================================

describe("shipment.service — findBySubOrderId", () => {
  it("根据子订单 ID 查询物流信息", async () => {
    const shipment = await shipmentService.findBySubOrderId(subOrderAId);
    expect(shipment).toBeTruthy();
    expect(shipment.subOrderId).toBe(subOrderAId);
    expect(shipment.carrier).toBe("顺丰速运");
    expect(shipment.trackingNo).toBe("SF1234567890");
  });

  it("不存在的物流记录抛出 NotFoundError", async () => {
    await expect(
      shipmentService.findBySubOrderId("non-existent")
    ).rejects.toThrow(NotFoundError);
  });
});
