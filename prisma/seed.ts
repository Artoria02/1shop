import { prisma } from "../src/db/prisma";
import { RegisterSource } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { code: "PLATFORM_ADMIN" },
    update: {},
    create: { code: "PLATFORM_ADMIN", name: "平台管理员", isSystem: true }
  });

  const merchantRole = await prisma.role.upsert({
    where: { code: "MERCHANT" },
    update: {},
    create: { code: "MERCHANT", name: "商家", isSystem: true }
  });

  const buyerRole = await prisma.role.upsert({
    where: { code: "BUYER" },
    update: {},
    create: { code: "BUYER", name: "买家", isSystem: true }
  });

  console.log("Roles created.");

  // Create permissions for Phase 2 + Phase 3
  const permissions = [
    { code: "merchant:review", name: "商家审核" },
    { code: "product:review", name: "商品审核" },
    { code: "category:manage", name: "类目管理" },
    { code: "brand:manage", name: "品牌管理" },
    { code: "order:view", name: "查看全部订单" },
    { code: "order:intervene", name: "平台介入订单" },
  ];

  for (const p of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, name: p.name }
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id }
    });
  }

  // Also bind Phase 2 permissions to legacy platform_super_admin role if it exists
  const legacyAdminRole = await prisma.role.findUnique({ where: { code: "platform_super_admin" } });
  if (legacyAdminRole) {
    for (const p of permissions) {
      const permission = await prisma.permission.findUnique({ where: { code: p.code } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: legacyAdminRole.id, permissionId: permission.id } },
          update: {},
          create: { roleId: legacyAdminRole.id, permissionId: permission.id }
        });
      }
    }
    console.log("Permissions also bound to legacy platform_super_admin role.");
  }

  console.log("Permissions created and bound to PLATFORM_ADMIN.");

  // Create default admin (PlatformAdmin — independent table)
  const adminPasswordHash = await bcrypt.hash("admin123", 12);
  await prisma.platformAdmin.upsert({
    where: { email: "admin@1shop.local" },
    update: {},
    create: {
      email: "admin@1shop.local",
      passwordHash: adminPasswordHash,
      displayName: "平台管理员"
    }
  });

  console.log("Default admin created: admin@1shop.local / admin123");

  // Create default merchant and owner user
  const merchantPasswordHash = await bcrypt.hash("merchant123", 12);
  const merchantUser = await prisma.user.upsert({
    where: { email: "merchant@1shop.local" },
    update: { phone: "13800138000" },
    create: {
      email: "merchant@1shop.local",
      phone: "13800138000",
      passwordHash: merchantPasswordHash,
      displayName: "测试商家",
      source: RegisterSource.SEED
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: merchantUser.id, roleId: merchantRole.id } },
    update: {},
    create: { userId: merchantUser.id, roleId: merchantRole.id }
  });

  const testMerchant = await prisma.merchant.upsert({
    where: { id: "seed_merchant_1" },
    update: {},
    create: {
      id: "seed_merchant_1",
      name: "测试店铺",
      type: "ENTERPRISE",
      status: "APPROVED",
      commissionRate: 500,
      contactName: "测试联系人",
      contactPhone: "13800138000",
      contactEmail: "merchant@1shop.local",
      description: "这是一个用于测试的店铺",
      address: "北京市朝阳区"
    }
  });

  // 主账号：通过 User.merchantId 直接关联店铺
  await prisma.user.update({
    where: { id: merchantUser.id },
    data: { merchantId: testMerchant.id }
  });

  console.log("Default merchant user created: merchant@1shop.local / merchant123");

  // Create default buyer user
  const buyerPasswordHash = await bcrypt.hash("buyer123", 12);
  const buyerUser = await prisma.user.upsert({
    where: { email: "buyer@1shop.local" },
    update: { phone: "13900139000" },
    create: {
      email: "buyer@1shop.local",
      phone: "13900139000",
      passwordHash: buyerPasswordHash,
      displayName: "测试买家",
      source: RegisterSource.SEED
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: buyerUser.id, roleId: buyerRole.id } },
    update: {},
    create: { userId: buyerUser.id, roleId: buyerRole.id }
  });

  console.log("Default buyer user created: buyer@1shop.local / buyer123");

  // Seed sample categories
  const electronics = await prisma.category.upsert({
    where: { id: "seed_cat_electronics" },
    update: {},
    create: { id: "seed_cat_electronics", name: "数码电器", sortOrder: 1 }
  });

  const clothing = await prisma.category.upsert({
    where: { id: "seed_cat_clothing" },
    update: {},
    create: { id: "seed_cat_clothing", name: "服饰鞋包", sortOrder: 2 }
  });

  await prisma.category.upsert({
    where: { id: "seed_cat_phone" },
    update: {},
    create: { id: "seed_cat_phone", name: "手机", parentId: electronics.id, sortOrder: 1 }
  });

  await prisma.category.upsert({
    where: { id: "seed_cat_computer" },
    update: {},
    create: { id: "seed_cat_computer", name: "电脑办公", parentId: electronics.id, sortOrder: 2 }
  });

  await prisma.category.upsert({
    where: { id: "seed_cat_men" },
    update: {},
    create: { id: "seed_cat_men", name: "男装", parentId: clothing.id, sortOrder: 1 }
  });

  await prisma.category.upsert({
    where: { id: "seed_cat_women" },
    update: {},
    create: { id: "seed_cat_women", name: "女装", parentId: clothing.id, sortOrder: 2 }
  });

  console.log("Sample categories created.");

  // Seed sample brands
  await prisma.brand.upsert({
    where: { id: "seed_brand_apple" },
    update: {},
    create: { id: "seed_brand_apple", name: "Apple" }
  });

  await prisma.brand.upsert({
    where: { id: "seed_brand_huawei" },
    update: {},
    create: { id: "seed_brand_huawei", name: "华为" }
  });

  await prisma.brand.upsert({
    where: { id: "seed_brand_nike" },
    update: {},
    create: { id: "seed_brand_nike", name: "Nike" }
  });

  console.log("Sample brands created.");

  // Seed sample approved products for testing
  const testProduct = await prisma.product.upsert({
    where: { id: "seed_product_1" },
    update: {},
    create: {
      id: "seed_product_1",
      merchantId: testMerchant.id,
      categoryId: "seed_cat_phone",
      brandId: "seed_brand_apple",
      name: "iPhone 15 Pro 测试手机",
      subtitle: "256GB 原色钛金属",
      mainImage: "",
      images: [],
      status: "APPROVED",
      saleStatus: "ON_SALE",
      specTemplate: [{ name: "颜色", values: ["原色钛金属", "蓝色钛金属"] }, { name: "容量", values: ["256GB", "512GB"] }],
    },
  });

  await prisma.sku.upsert({
    where: { id: "seed_sku_1a" },
    update: {},
    create: {
      id: "seed_sku_1a",
      productId: testProduct.id,
      skuCode: "IP15P-256-NAT",
      specs: { "颜色": "原色钛金属", "容量": "256GB" },
      price: 899900,
      originalPrice: 999900,
      stock: 100,
      status: "ON_SALE",
    },
  });

  await prisma.sku.upsert({
    where: { id: "seed_sku_1b" },
    update: {},
    create: {
      id: "seed_sku_1b",
      productId: testProduct.id,
      skuCode: "IP15P-512-BLU",
      specs: { "颜色": "蓝色钛金属", "容量": "512GB" },
      price: 1099900,
      originalPrice: 1199900,
      stock: 50,
      status: "ON_SALE",
    },
  });

  console.log("Sample test products created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
