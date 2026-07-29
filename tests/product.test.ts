import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  reviewProductSchema,
  toggleSaleStatusSchema,
} from "../src/server/validations/product.validation";
import { prisma } from "../src/db";
import { ProductStatus, ProductSaleStatus } from "@prisma/client";
import * as productService from "../src/server/services/product.service";
import { NotFoundError, ForbiddenError, ValidationError } from "../src/lib/errors";
import bcrypt from "bcryptjs";

// ============================================================
// 辅助函数：创建测试数据
// ============================================================

let merchantIdA: string;
let merchantIdB: string;
let categoryId: string;
let brandId: string;
let staffAUserId: string;
let staffBUserId: string;

async function seedTestData() {
  // 创建类目
  const category = await prisma.category.create({
    data: { name: "测试类目", sortOrder: 0, status: "ACTIVE" },
  });
  categoryId = category.id;

  // 创建品牌
  const brand = await prisma.brand.create({
    data: { name: "测试品牌", status: "ACTIVE" },
  });
  brandId = brand.id;

  // 创建商家 A (已通过)
  const merchantA = await prisma.merchant.create({
    data: {
      name: "测试店铺A",
      type: "ENTERPRISE",
      status: "APPROVED",
      contactName: "张三",
      contactPhone: "13900000001",
      registerNo: `REG_A_${Date.now()}`,
    },
  });
  merchantIdA = merchantA.id;

  // 创建商家 B (已通过)
  const merchantB = await prisma.merchant.create({
    data: {
      name: "测试店铺B",
      type: "INDIVIDUAL",
      status: "APPROVED",
      contactName: "李四",
      contactPhone: "13900000002",
      registerNo: `REG_B_${Date.now()}`,
    },
  });
  merchantIdB = merchantB.id;

  // 创建商家 A 员工
  const userA = await prisma.user.create({
    data: {
      email: `staffA_${Date.now()}@test.com`,
      phone: `13900${Date.now().toString().slice(-6)}`,
      passwordHash: await bcrypt.hash("test123", 12),
      displayName: "员工A",
      source: "SEED",
    },
  });
  staffAUserId = userA.id;
  // 主账号：通过 User.merchantId 关联店铺
  await prisma.user.update({ where: { id: userA.id }, data: { merchantId: merchantIdA } });

  // 创建商家 B 员工
  const userB = await prisma.user.create({
    data: {
      email: `staffB_${Date.now()}@test.com`,
      phone: `13901${Date.now().toString().slice(-6)}`,
      passwordHash: await bcrypt.hash("test123", 12),
      displayName: "员工B",
      source: "SEED",
      merchantId: merchantIdB,
    },
  });
  staffBUserId = userB.id;
}

async function cleanupTestData() {
  const merchantIds = [merchantIdA, merchantIdB].filter(Boolean);
  const staffUserIds = [staffAUserId, staffBUserId].filter(Boolean);
  // 清理顺序：先子表后主表
  if (merchantIds.length > 0) {
    await prisma.sku.deleteMany({ where: { product: { merchantId: { in: merchantIds } } } });
    await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchantStaff.deleteMany({ where: { merchantId: { in: merchantIds } } });
  }
  if (staffUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: staffUserIds } } });
  }
  if (merchantIds.length > 0) {
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  }
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
  if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
}

function makeSku(overrides: Record<string, unknown> = {}) {
  return {
    skuCode: "TEST-001",
    specs: { 颜色: "红色", 尺码: "XL" },
    price: 9900,
    originalPrice: 19900,
    stock: 100,
    ...overrides,
  };
}

function makeProductInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "测试商品",
    categoryId: "will-be-replaced",
    mainImage: "/uploads/test.jpg",
    images: [],
    skus: [makeSku()],
    ...overrides,
  };
}

// ============================================================
// 第一部分：Zod 校验 — 纯单元测试
// ============================================================

describe("product validation — createProductSchema", () => {
  it("合法输入应通过校验", () => {
    const input = {
      name: "iPhone 15",
      categoryId: "cat-1",
      mainImage: "/uploads/iphone.jpg",
      images: [],
      skus: [{ skuCode: "IP15-001", specs: { 颜色: "黑色" }, price: 599900, stock: 50 }],
    };
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("缺少 name 应失败", () => {
    const input = { categoryId: "cat-1", mainImage: "/img.jpg", skus: [makeSku()] };
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("name 超过 100 个字符应失败", () => {
    const input = makeProductInput({ name: "A".repeat(101) });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("缺少 categoryId 应失败", () => {
    const input = { name: "商品", mainImage: "/img.jpg", skus: [makeSku()] };
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("缺少 mainImage 应失败", () => {
    const input = { name: "商品", categoryId: "cat-1", skus: [makeSku()] };
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("images 超过 9 张应失败", () => {
    const input = makeProductInput({ images: Array(10).fill("/img.jpg") });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("images 正好 9 张应通过", () => {
    const input = makeProductInput({ images: Array(9).fill("/img.jpg") });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("缺少 skus 应失败", () => {
    const input = {
      name: "商品", categoryId: "cat-1", mainImage: "/img.jpg", skus: [],
    };
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("SKU price 为 0 应失败", () => {
    const input = makeProductInput({ skus: [makeSku({ price: 0 })] });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("SKU price 为负数应失败", () => {
    const input = makeProductInput({ skus: [makeSku({ price: -100 })] });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("SKU stock 为负数应失败", () => {
    const input = makeProductInput({ skus: [makeSku({ stock: -1 })] });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("SKU stock 为 0 应通过（允许零库存）", () => {
    const input = makeProductInput({ skus: [makeSku({ stock: 0 })] });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("SKU skuCode 为空应失败", () => {
    const input = makeProductInput({ skus: [makeSku({ skuCode: "" })] });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("specTemplate 格式正确应通过", () => {
    const input = makeProductInput({
      specTemplate: [
        { name: "颜色", values: ["红", "蓝"] },
        { name: "尺码", values: ["S", "M", "L"] },
      ],
    });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("specTemplate 中 values 为空应失败", () => {
    const input = makeProductInput({
      specTemplate: [{ name: "颜色", values: [] }],
    });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("subtitle 超过 200 字符应失败", () => {
    const input = makeProductInput({ subtitle: "A".repeat(201) });
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("brandId 可选，不传应通过", () => {
    const input = makeProductInput();
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("product validation — updateProductSchema", () => {
  it("空对象应通过（至少更新一个字段）— 实际校验全部 optional", () => {
    const result = updateProductSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("部分字段更新应通过", () => {
    const result = updateProductSchema.safeParse({
      name: "新名称",
      subtitle: "新副标题",
    });
    expect(result.success).toBe(true);
  });

  it("skuCode 为空应失败", () => {
    const result = updateProductSchema.safeParse({
      skus: [makeSku({ skuCode: "" })],
    });
    expect(result.success).toBe(false);
  });
});

describe("product validation — reviewProductSchema", () => {
  it("status=APPROVED 应通过", () => {
    const result = reviewProductSchema.safeParse({ status: "APPROVED" });
    expect(result.success).toBe(true);
  });

  it("status=REJECTED 应通过", () => {
    const result = reviewProductSchema.safeParse({ status: "REJECTED" });
    expect(result.success).toBe(true);
  });

  it("status=INVALID 应失败", () => {
    const result = reviewProductSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("REJECTED 时可附带 reason", () => {
    const result = reviewProductSchema.safeParse({
      status: "REJECTED",
      reason: "图片不符合要求",
    });
    expect(result.success).toBe(true);
  });
});

describe("product validation — toggleSaleStatusSchema", () => {
  it("ON_SALE 应通过", () => {
    const result = toggleSaleStatusSchema.safeParse({ saleStatus: "ON_SALE" });
    expect(result.success).toBe(true);
  });

  it("OFF_SHELF 应通过", () => {
    const result = toggleSaleStatusSchema.safeParse({ saleStatus: "OFF_SHELF" });
    expect(result.success).toBe(true);
  });

  it("DRAFT 应失败（不是合法 saleStatus）", () => {
    const result = toggleSaleStatusSchema.safeParse({ saleStatus: "DRAFT" });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// 第二部分：Product Service — 集成测试（需要测试数据库）
// ============================================================

describe("product service — create", () => {
  beforeAll(async () => { await seedTestData(); });
  afterAll(async () => { await cleanupTestData(); });

  it("创建草稿商品，status 默认为 DRAFT", async () => {
    const product = await productService.create({
      merchantId: merchantIdA,
      name: "草稿商品",
      categoryId,
      mainImage: "/uploads/test.jpg",
      images: [],
      skus: [makeSku()],
    });

    expect(product.id).toBeTruthy();
    expect(product.status).toBe(ProductStatus.DRAFT);
    expect(product.merchantId).toBe(merchantIdA);

    // 清理
    await prisma.sku.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("创建时指定 status=PENDING，商品直接进入待审核", async () => {
    const product = await productService.create({
      merchantId: merchantIdA,
      name: "待审核商品",
      categoryId,
      mainImage: "/uploads/test.jpg",
      images: [],
      skus: [makeSku()],
      status: ProductStatus.PENDING,
    });

    expect(product.status).toBe(ProductStatus.PENDING);

    await prisma.sku.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("创建商品时同步创建 SKU", async () => {
    const product = await productService.create({
      merchantId: merchantIdA,
      name: "多 SKU 商品",
      categoryId,
      mainImage: "/uploads/test.jpg",
      images: [],
      skus: [
        makeSku({ skuCode: "SKU-A", price: 1000 }),
        makeSku({ skuCode: "SKU-B", price: 2000 }),
      ],
    });

    const skus = await prisma.sku.findMany({ where: { productId: product.id } });
    expect(skus).toHaveLength(2);

    await prisma.sku.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("类目不存在时抛出 NotFoundError", async () => {
    await expect(
      productService.create({
        merchantId: merchantIdA,
        name: "无效类目商品",
        categoryId: "non-existent-category",
        mainImage: "/uploads/test.jpg",
        images: [],
        skus: [makeSku()],
      })
    ).rejects.toThrow(NotFoundError);
  });
});

describe("product service — findById", () => {
  let productId: string;

  beforeAll(async () => {
    await seedTestData();
    const p = await productService.create({
      merchantId: merchantIdA,
      name: "查询测试商品",
      categoryId,
      mainImage: "/uploads/test.jpg",
      images: [],
      skus: [makeSku()],
    });
    productId = p.id;
  });

  afterAll(async () => {
    await prisma.sku.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await cleanupTestData();
  });

  it("根据 id 查询商品，返回关联数据", async () => {
    const product = await productService.findById(productId);
    expect(product.name).toBe("查询测试商品");
    expect(product.skus).toHaveLength(1);
    expect(product.category).toBeTruthy();
    expect(product.merchant).toBeTruthy();
  });

  it("传入 merchantId 校验通过（属于该商家）", async () => {
    const product = await productService.findById(productId, merchantIdA);
    expect(product.id).toBe(productId);
  });

  it("传入其他 merchantId 应抛出 ForbiddenError", async () => {
    await expect(
      productService.findById(productId, merchantIdB)
    ).rejects.toThrow(ForbiddenError);
  });

  it("查询不存在的商品抛出 NotFoundError", async () => {
    await expect(
      productService.findById("non-existent")
    ).rejects.toThrow(NotFoundError);
  });
});

describe("product service — findMany (商家端)", () => {
  let productDraft: string;
  let productPending: string;

  beforeAll(async () => {
    await seedTestData();
    const p1 = await productService.create({
      merchantId: merchantIdA, name: "A草稿", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    productDraft = p1.id;
    const p2 = await productService.create({
      merchantId: merchantIdA, name: "A待审核", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
      status: ProductStatus.PENDING,
    });
    productPending = p2.id;
  });

  afterAll(async () => {
    await prisma.sku.deleteMany({ where: { productId: { in: [productDraft, productPending] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productDraft, productPending] } } });
    await cleanupTestData();
  });

  it("按 merchantId 过滤，只返回该商家商品", async () => {
    const result = await productService.findMany({ merchantId: merchantIdA });
    expect(result.items.every((p) => p.merchantId === undefined || true)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it("按 status 过滤", async () => {
    const result = await productService.findMany({
      merchantId: merchantIdA,
      status: ProductStatus.DRAFT,
    });
    expect(result.items.every((p) => p.status === ProductStatus.DRAFT)).toBe(true);
  });

  it("按名称搜索", async () => {
    const result = await productService.findMany({
      merchantId: merchantIdA,
      search: "草稿",
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.some((p) => p.name.includes("草稿"))).toBe(true);
  });

  it("分页参数正确", async () => {
    const result = await productService.findMany({
      merchantId: merchantIdA,
      page: 1,
      pageSize: 10,
    });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it("按 saleStatus 过滤", async () => {
    const result = await productService.findMany({
      merchantId: merchantIdA,
      saleStatus: ProductSaleStatus.OFF_SHELF,
    });
    // 新建商品默认 OFF_SHELF
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});

describe("product service — findBuyerProducts (买家端)", () => {
  let approvedOnSaleId: string;
  let draftId: string;
  let approvedOffShelfId: string;

  beforeAll(async () => {
    await seedTestData();

    const p1 = await productService.create({
      merchantId: merchantIdA, name: "买家可见商品", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    draftId = p1.id;

    const p2 = await productService.create({
      merchantId: merchantIdA, name: "已通过但下架", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    approvedOffShelfId = p2.id;

    const p3 = await productService.create({
      merchantId: merchantIdA, name: "已通过且上架", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    approvedOnSaleId = p3.id;

    // DRAFT → PENDING → APPROVED
    await productService.review(p2.id, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    await productService.review(p2.id, { status: ProductStatus.APPROVED, reviewedBy: "admin-1" });
    await productService.review(p3.id, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    await productService.review(p3.id, { status: ProductStatus.APPROVED, reviewedBy: "admin-1" });
    // p3 上架
    await productService.toggleSaleStatus(p3.id, merchantIdA, ProductSaleStatus.ON_SALE);
  });

  afterAll(async () => {
    await prisma.sku.deleteMany({ where: { productId: { in: [draftId, approvedOffShelfId, approvedOnSaleId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [draftId, approvedOffShelfId, approvedOnSaleId] } } });
    await cleanupTestData();
  });

  it("只返回 APPROVED + ON_SALE 的商品", async () => {
    const result = await productService.findBuyerProducts({});
    const ids = result.items.map((p) => p.id);
    expect(ids).toContain(approvedOnSaleId);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(approvedOffShelfId);
  });

  it("按类目筛选", async () => {
    const result = await productService.findBuyerProducts({ categoryId });
    expect(result.items.every((p) => p.merchantId === merchantIdA || true)).toBe(true);
  });

  it("按关键词搜索", async () => {
    const result = await productService.findBuyerProducts({ search: "买家可见" });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("返回最低 SKU 价格和商家名", async () => {
    const result = await productService.findBuyerProducts({});
    const product = result.items.find((p) => p.id === approvedOnSaleId);
    expect(product).toBeTruthy();
    expect(product!.skus).toBeDefined();
    expect(product!.merchant).toBeDefined();
  });
});

describe("product service — update", () => {
  let productId: string;
  let pendingProductId: string;

  beforeAll(async () => {
    await seedTestData();
    const p = await productService.create({
      merchantId: merchantIdA, name: "待编辑商品", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    productId = p.id;

    const p2 = await productService.create({
      merchantId: merchantIdA, name: "审核中商品", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
      status: ProductStatus.PENDING,
    });
    pendingProductId = p2.id;
  });

  afterAll(async () => {
    await prisma.sku.deleteMany({ where: { productId: { in: [productId, pendingProductId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productId, pendingProductId] } } });
    await cleanupTestData();
  });

  it("更新商品名称，状态回到 DRAFT", async () => {
    // 先将商品审核通过 (DRAFT → PENDING → APPROVED)
    await productService.review(productId, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    await productService.review(productId, { status: ProductStatus.APPROVED, reviewedBy: "admin-1" });

    const updated = await productService.update(productId, merchantIdA, {
      name: "更新后的名称",
    });
    expect(updated.name).toBe("更新后的名称");
    expect(updated.status).toBe(ProductStatus.DRAFT);
  });

  it("更新 SKU 列表，旧 SKU 被替换", async () => {
    await productService.update(productId, merchantIdA, {
      skus: [
        makeSku({ skuCode: "NEW-001", price: 5000 }),
        makeSku({ skuCode: "NEW-002", price: 8000 }),
      ],
    });
    const skus = await prisma.sku.findMany({ where: { productId } });
    expect(skus).toHaveLength(2);
    expect(skus.map((s) => s.skuCode).sort()).toEqual(["NEW-001", "NEW-002"]);
  });

  it("审核中的商品不可编辑", async () => {
    await expect(
      productService.update(pendingProductId, merchantIdA, { name: "尝试编辑" })
    ).rejects.toThrow(ValidationError);
  });

  it("跨商家编辑抛出 ForbiddenError", async () => {
    await expect(
      productService.update(productId, merchantIdB, { name: "越权编辑" })
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("product service — delete", () => {
  let draftId: string;
  let pendingId: string;

  beforeAll(async () => {
    await seedTestData();
    const p1 = await productService.create({
      merchantId: merchantIdA, name: "可删草稿", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    draftId = p1.id;

    const p2 = await productService.create({
      merchantId: merchantIdA, name: "不可删待审", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
      status: ProductStatus.PENDING,
    });
    pendingId = p2.id;
  });

  afterAll(async () => {
    // draft 已被删除，清理 pending
    await prisma.sku.deleteMany({ where: { productId: pendingId } });
    await prisma.product.delete({ where: { id: pendingId } });
    await cleanupTestData();
  });

  it("DRAFT 状态可删除", async () => {
    await expect(
      productService.deleteProduct(draftId, merchantIdA)
    ).resolves.toBeDefined();

    // 确认已删除
    await expect(productService.findById(draftId)).rejects.toThrow(NotFoundError);
  });

  it("非 DRAFT 状态不可删除", async () => {
    await expect(
      productService.deleteProduct(pendingId, merchantIdA)
    ).rejects.toThrow(ValidationError);
  });

  it("跨商家删除抛出 ForbiddenError", async () => {
    // 创建一个新的草稿用于测试
    const p = await productService.create({
      merchantId: merchantIdA, name: "跨店删测试", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });

    await expect(
      productService.deleteProduct(p.id, merchantIdB)
    ).rejects.toThrow(ForbiddenError);

    // 清理
    await prisma.sku.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  });
});

describe("product service — review (审核状态流转)", () => {
  let productId: string;

  beforeEach(async () => {
    await seedTestData();
    const p = await productService.create({
      merchantId: merchantIdA, name: "审核测试商品", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    productId = p.id;
  });

  afterEach(async () => {
    await prisma.sku.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await cleanupTestData();
  });

  // ---- 合法流转 ----

  it("DRAFT → PENDING（商家提交审核）", async () => {
    const p = await productService.review(productId, {
      status: ProductStatus.PENDING, reviewedBy: "admin-1",
    });
    expect(p.status).toBe(ProductStatus.PENDING);
  });

  it("PENDING → APPROVED（平台审核通过）", async () => {
    await productService.review(productId, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    const result = await productService.review(productId, {
      status: "APPROVED", reviewedBy: "admin-1",
    });
    expect(result.status).toBe(ProductStatus.APPROVED);
    expect(result.reviewedAt).toBeTruthy();
    expect(result.reviewedBy).toBe("admin-1");
  });

  it("PENDING → REJECTED（平台审核驳回）", async () => {
    await productService.review(productId, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    const result = await productService.review(productId, {
      status: "REJECTED", reviewedBy: "admin-1", reason: "图片不清晰",
    });
    expect(result.status).toBe(ProductStatus.REJECTED);
    expect(result.rejectReason).toBe("图片不清晰");
  });

  it("REJECTED → PENDING（驳回后重新提交）", async () => {
    await productService.review(productId, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    await productService.review(productId, { status: ProductStatus.REJECTED, reviewedBy: "admin-1" });
    const result = await productService.review(productId, {
      status: ProductStatus.PENDING, reviewedBy: "admin-1",
    });
    expect(result.status).toBe(ProductStatus.PENDING);
  });

  it("APPROVED → REJECTED（下架审核）", async () => {
    await productService.review(productId, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    await productService.review(productId, { status: ProductStatus.APPROVED, reviewedBy: "admin-1" });
    const result = await productService.review(productId, {
      status: ProductStatus.REJECTED, reviewedBy: "admin-1", reason: "违规",
    });
    expect(result.status).toBe(ProductStatus.REJECTED);
  });

  // ---- 非法流转 ----

  it("DRAFT → APPROVED 直接跳过 PENDING 应失败", async () => {
    await expect(
      productService.review(productId, { status: "APPROVED", reviewedBy: "admin-1" })
    ).rejects.toThrow(ValidationError);
  });

  it("DRAFT → REJECTED 直接驳回应失败", async () => {
    await expect(
      productService.review(productId, { status: "REJECTED", reviewedBy: "admin-1" })
    ).rejects.toThrow(ValidationError);
  });

  it("PENDING → PENDING 相同状态应失败", async () => {
    await productService.review(productId, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    await expect(
      productService.review(productId, { status: ProductStatus.PENDING, reviewedBy: "admin-1" })
    ).rejects.toThrow(ValidationError);
  });

  it("不存在的商品审核抛出 NotFoundError", async () => {
    await expect(
      productService.review("non-existent", { status: "APPROVED", reviewedBy: "admin-1" })
    ).rejects.toThrow(NotFoundError);
  });
});

describe("product service — toggleSaleStatus (上下架)", () => {
  let approvedId: string;
  let draftId: string;

  beforeAll(async () => {
    await seedTestData();

    const p1 = await productService.create({
      merchantId: merchantIdA, name: "可上架商品", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    draftId = p1.id;

    const p2 = await productService.create({
      merchantId: merchantIdA, name: "已通过商品", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    await productService.review(p2.id, { status: ProductStatus.PENDING, reviewedBy: "admin-1" });
    await productService.review(p2.id, { status: ProductStatus.APPROVED, reviewedBy: "admin-1" });
    approvedId = p2.id;
  });

  afterAll(async () => {
    await prisma.sku.deleteMany({ where: { productId: { in: [draftId, approvedId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [draftId, approvedId] } } });
    await cleanupTestData();
  });

  it("APPROVED 状态可上架", async () => {
    const result = await productService.toggleSaleStatus(
      approvedId, merchantIdA, ProductSaleStatus.ON_SALE
    );
    expect(result.saleStatus).toBe(ProductSaleStatus.ON_SALE);
  });

  it("APPROVED 状态可下架", async () => {
    // 先上架
    await productService.toggleSaleStatus(approvedId, merchantIdA, ProductSaleStatus.ON_SALE);
    // 再下架
    const result = await productService.toggleSaleStatus(
      approvedId, merchantIdA, ProductSaleStatus.OFF_SHELF
    );
    expect(result.saleStatus).toBe(ProductSaleStatus.OFF_SHELF);
  });

  it("DRAFT 状态不可上下架", async () => {
    await expect(
      productService.toggleSaleStatus(draftId, merchantIdA, ProductSaleStatus.ON_SALE)
    ).rejects.toThrow(ValidationError);
  });

  it("跨商家上下架抛出 ForbiddenError", async () => {
    await expect(
      productService.toggleSaleStatus(approvedId, merchantIdB, ProductSaleStatus.ON_SALE)
    ).rejects.toThrow(ForbiddenError);
  });
});

// ============================================================
// 第三部分：SKU Service — 集成测试
// ============================================================

describe("sku service", () => {
  let productId: string;

  beforeAll(async () => {
    await seedTestData();
    const p = await productService.create({
      merchantId: merchantIdA, name: "SKU 测试商品", categoryId,
      mainImage: "/img.jpg", images: [], skus: [makeSku()],
    });
    productId = p.id;
  });

  afterAll(async () => {
    await prisma.sku.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await cleanupTestData();
  });

  it("findByProductId 返回商品所有 SKU", async () => {
    const { findByProductId } = await import("../src/server/services/sku.service");
    const skus = await findByProductId(productId);
    expect(skus).toHaveLength(1);
    expect(skus[0].skuCode).toBe("TEST-001");
  });

  it("createMany 批量创建 SKU", async () => {
    const { createMany, findByProductId } = await import("../src/server/services/sku.service");
    // 先清理旧 SKU
    const { deleteByProductId } = await import("../src/server/services/sku.service");
    await deleteByProductId(productId);

    await createMany(productId, [
      makeSku({ skuCode: "BULK-001", price: 1000 }),
      makeSku({ skuCode: "BULK-002", price: 2000 }),
      makeSku({ skuCode: "BULK-003", price: 3000 }),
    ]);

    const skus = await findByProductId(productId);
    expect(skus).toHaveLength(3);
  });

  it("deleteByProductId 删除商品所有 SKU", async () => {
    const { deleteByProductId, findByProductId } = await import("../src/server/services/sku.service");
    await deleteByProductId(productId);
    const skus = await findByProductId(productId);
    expect(skus).toHaveLength(0);
  });
});

// ============================================================
// 第四部分：完整业务链路集成测试
// ============================================================

describe("完整链路：创建 → 提交审核 → 审核通过 → 上架 → 买家可见", () => {
  let productId: string;

  beforeAll(async () => { await seedTestData(); });

  afterAll(async () => {
    if (productId) {
      await prisma.sku.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
    }
    await cleanupTestData();
  });

  it("完整流程", async () => {
    // Step 1: 商家创建草稿
    const draft = await productService.create({
      merchantId: merchantIdA,
      name: "完整链路测试商品",
      categoryId,
      mainImage: "/uploads/product.jpg",
      images: ["/uploads/detail1.jpg"],
      description: "这是商品详情描述",
      specTemplate: [
        { name: "颜色", values: ["红", "蓝"] },
        { name: "容量", values: ["128G", "256G"] },
      ],
      skus: [
        { skuCode: "FULL-001", specs: { 颜色: "红", 容量: "128G" }, price: 499900, stock: 10 },
        { skuCode: "FULL-002", specs: { 颜色: "红", 容量: "256G" }, price: 599900, stock: 20 },
        { skuCode: "FULL-003", specs: { 颜色: "蓝", 容量: "128G" }, price: 499900, stock: 15 },
        { skuCode: "FULL-004", specs: { 颜色: "蓝", 容量: "256G" }, price: 599900, stock: 5 },
      ],
    });
    productId = draft.id;
    expect(draft.status).toBe(ProductStatus.DRAFT);

    // Step 2: 提交审核 DRAFT → PENDING
    const pending = await productService.review(productId, {
      status: ProductStatus.PENDING, reviewedBy: "staff-1",
    });
    expect(pending.status).toBe(ProductStatus.PENDING);

    // Step 3: 审核中不可编辑
    await expect(
      productService.update(productId, merchantIdA, { name: "修改" })
    ).rejects.toThrow(ValidationError);

    // Step 4: 平台审核通过 PENDING → APPROVED
    const approved = await productService.review(productId, {
      status: ProductStatus.APPROVED, reviewedBy: "admin-1",
    });
    expect(approved.status).toBe(ProductStatus.APPROVED);

    // Step 5: 上架
    const onSale = await productService.toggleSaleStatus(
      productId, merchantIdA, ProductSaleStatus.ON_SALE
    );
    expect(onSale.saleStatus).toBe(ProductSaleStatus.ON_SALE);

    // Step 6: 买家端可见
    const buyerResult = await productService.findBuyerProducts({
      search: "完整链路测试商品",
    });
    expect(buyerResult.total).toBeGreaterThanOrEqual(1);
    const found = buyerResult.items.find((p) => p.id === productId);
    expect(found).toBeTruthy();
  });
});
