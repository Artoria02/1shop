# Phase 2 — 商家与商品系统

> 对应 [PLAN.md](./PLAN.md) 第二阶段。
> 前置条件：Phase 1 基础架构、认证、权限、三端布局已完成并通过验收。

## 总体目标

实现**商家入驻审核**与**商品全生命周期管理**，打通"商家申请→平台审核→商品发布→平台审核→买家可见"的完整链路。本阶段不产生交易，但需为第三阶段交易闭环准备好商家、商品、库存、价格等全部基础数据。

## 技术栈

沿用 Phase 1 选型，无新增基础设施依赖。

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js App Router + TypeScript |
| 数据库 | PostgreSQL + Prisma |
| 缓存 | Redis（审核状态缓存、商品详情缓存） |
| 文件存储 | 首版使用本地文件上传 + 静态服务，预留对象存储接口 |
| 校验 | Zod |

---

## 数据模型变更（Prisma Schema）

### 新增枚举

```prisma
enum MerchantType {
  ENTERPRISE    // 企业
  INDIVIDUAL    // 个体工商户
}

enum MerchantStatus {
  PENDING       // 待审核
  APPROVED      // 已通过
  REJECTED      // 已拒绝
  DISABLED      // 已禁用
}

enum ProductStatus {
  DRAFT         // 草稿
  PENDING       // 待审核
  APPROVED      // 已通过（可上架）
  REJECTED      // 审核驳回
}

enum ProductSaleStatus {
  OFF_SHELF     // 下架
  ON_SALE       // 上架中
}

enum CategoryStatus {
  ACTIVE
  DISABLED
}
```

### 新增模型

#### Merchant（商家主体）
```prisma
model Merchant {
  id                String        @id @default(cuid())
  name              String        // 店铺名称
  type              MerchantType
  status            MerchantStatus @default(PENDING)
  commissionRate    Int           @default(500) // 佣金比例，万分之一为单位，500=5%

  // 资质信息
  businessLicense   String?       // 营业执照图片URL
  legalPersonName   String?
  legalPersonIdCard String?       // 法人身份证图片URL
  registerNo        String?       @unique // 统一社会信用代码

  // 联系信息
  contactName       String
  contactPhone      String
  contactEmail      String?

  // 结算账户
  bankAccountName   String?
  bankAccountNo     String?
  bankName          String?

  // 店铺信息
  logo              String?
  description       String?
  address           String?

  rejectionReason   String?       // 审核驳回原因

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  reviewedAt        DateTime?
  reviewedBy        String?       // 审核人ID

  staff             MerchantStaff[]
  products          Product[]

  @@index([status, createdAt])
  @@index([registerNo])
}
```

#### MerchantStaff（商家员工）
```prisma
model MerchantStaff {
  id          String   @id @default(cuid())
  merchantId  String
  userId      String
  isOwner     Boolean  @default(false) // 是否店主
  displayName String?  // 员工昵称（如"员工xxxx"）
  createdAt   DateTime @default(now())

  merchant    Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([merchantId, userId])
  @@index([merchantId])
}
```

> **架构**：`userId` 非唯一——同一 User 可同时是买家（有 BuyerProfile）和多家店铺员工。买家端昵称取自 `BuyerProfile.displayName`，商家端昵称取自 `MerchantStaff.displayName`。

#### Category（类目，平台统一维护）
```prisma
model Category {
  id          String          @id @default(cuid())
  parentId    String?         // 父类目ID，null为一级类目
  name        String
  sortOrder   Int             @default(0)
  status      CategoryStatus  @default(ACTIVE)
  icon        String?         // 图标URL
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  parent      Category?       @relation("CategoryChildren", fields: [parentId], references: [id], onDelete: SetNull)
  children    Category[]      @relation("CategoryChildren")
  products    Product[]

  @@index([parentId, sortOrder])
  @@index([status])
}
```

#### Brand（品牌，平台统一维护）
```prisma
model Brand {
  id          String   @id @default(cuid())
  name        String   @unique
  logo        String?
  description String?
  status      CategoryStatus @default(ACTIVE) // 复用 ACTIVE/DISABLED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  products    Product[]
}
```

#### Product（商品 SPU）
```prisma
model Product {
  id            String             @id @default(cuid())
  merchantId    String
  categoryId    String
  brandId       String?

  name          String
  subtitle      String?
  description   String?            // 富文本/HTML
  mainImage     String             // 主图URL
  images        String[]           // 详情图URL数组

  status        ProductStatus      @default(DRAFT)
  saleStatus    ProductSaleStatus  @default(OFF_SHELF)

  // 规格模板（JSON）：如 [{"name":"颜色","values":["红","蓝"]}]
  specTemplate  Json?

  // 审核
  reviewedAt    DateTime?
  reviewedBy    String?
  rejectReason  String?

  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  merchant      Merchant           @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  category      Category           @relation(fields: [categoryId], references: [id])
  brand         Brand?             @relation(fields: [brandId], references: [id])
  skus          Sku[]

  @@index([merchantId, status, saleStatus])
  @@index([categoryId])
  @@index([status, reviewedAt])
}
```

#### Sku（商品 SKU）
```prisma
model Sku {
  id            String   @id @default(cuid())
  productId     String
  skuCode       String   @unique // SKU编码，商家可自定义或自动生成

  // 规格组合（JSON）：如 {"颜色":"红","尺码":"XL"}
  specs         Json

  price         Int      // 售价，单位：分
  originalPrice Int?     // 划线价，单位：分
  stock         Int      @default(0)
  salesCount    Int      @default(0) // 销量统计
  image         String?  // SKU专属图

  status        ProductSaleStatus @default(OFF_SHELF)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([skuCode])
  @@index([status])
}
```

### AuditAction 扩展

在现有 `AuditAction` 枚举中追加：
```prisma
enum AuditAction {
  // ... 已有值
  MERCHANT_CREATED
  MERCHANT_UPDATED
  MERCHANT_REVIEWED
  PRODUCT_CREATED
  PRODUCT_UPDATED
  PRODUCT_REVIEWED
  CATEGORY_CREATED
  CATEGORY_UPDATED
  BRAND_CREATED
  BRAND_UPDATED
}
```

---

## 实施步骤

### 1. 数据库迁移与 Seed

- 编写以上 Schema 变更，生成迁移 `prisma migrate dev --name phase2_merchant_product`
- 更新 `prisma/seed.ts`：
  - 追加平台默认权限：`merchant:review`、`product:review`、`category:manage`、`brand:manage`
  - 为 `PLATFORM_ADMIN` 角色绑定新权限
  - 创建示例类目树（如：数码/手机、数码/电脑、服饰/男装、服饰/女装）
  - 创建示例品牌（如：Apple、华为、Nike）
- 验证 `db:migrate` + `db:seed` 通过

### 2. 商家入驻与审核

#### 2.1 商家入驻申请（买家端 / 公开页）
- 页面：`/merchant/apply`（无需登录，或登录后自动关联）
- 表单字段：店铺名称、商家类型（企业/个体）、营业执照、统一社会信用代码、法人姓名、法人身份证、联系人姓名、联系人手机、联系人邮箱、结算银行卡信息
- 上传：首版使用 Next.js API Route 接收 multipart/form-data，保存到 `public/uploads/`，返回可访问 URL（预留对象存储接口 `lib/storage.ts`）
- 提交后创建 `Merchant` 记录（status=PENDING），若用户已登录则同时创建 `MerchantStaff(isOwner=true)` 关联
- 写入审计日志 `MERCHANT_CREATED`

#### 2.2 平台审核商家
- 页面：`/admin/merchants`
  - 列表：按状态筛选（待审核/已通过/已拒绝/已禁用）、搜索店铺名/注册号
  - 操作：查看详情（含资质图片）、通过、驳回（填原因）、禁用/启用
- 页面：`/admin/merchants/[id]` 详情页
- API：`PATCH /api/admin/merchants/[id]/review`
  - 权限校验：`merchant:review`
  - 状态流转：PENDING → APPROVED / REJECTED；APPROVED ↔ DISABLED
  - 写入审计日志 `MERCHANT_REVIEWED`

#### 2.3 商家员工管理
- 页面：`/merchant/settings/staff`（商家后台）
- 功能：店主可添加员工（输入手机号，系统查找或创建 User 并绑定 `MerchantStaff`）
- 限制：首版商家员工不细分角色，所有员工拥有同等店铺操作权限，仅店主可管理员工

#### 2.4 商家登录调整
- 审核通过的商家员工登录后，`getSessionUser()` 需通过 `MerchantStaff` 表查询并注入 `merchantId`
- 商家后台 layout 已读取 `merchantId`，本阶段确保其正确填充

### 3. 类目与品牌管理（平台后台）

#### 3.1 类目管理
- 页面：`/admin/categories`
  - 树形/层级展示（一级 → 二级 → 三级）
  - 操作：新增（选父类目）、编辑名称/排序/图标、启用/禁用
- API：`/api/admin/categories` CRUD
- 权限：`category:manage`

#### 3.2 品牌管理
- 页面：`/admin/brands`
  - 列表：名称、Logo、状态
  - 操作：新增、编辑、启用/禁用
- API：`/api/admin/brands` CRUD
- 权限：`brand:manage`

### 4. 商品系统（商家后台 + 平台后台 + 买家端）

#### 4.1 商品发布（商家后台）
- 页面：`/merchant/products/create`
- 表单：
  - 基础信息：名称、副标题、类目（三级级联选择，只显示 ACTIVE 类目）、品牌（可选）
  - 商品图：主图 1 张（必填）、详情图多张（最多 9 张）
  - 商品详情：富文本编辑器（首版可用 textarea 或简单 HTML）
  - 规格模板：动态添加规格名和规格值（如颜色：红/蓝/黑）
  - SKU 矩阵：根据规格模板自动生成 SKU 组合表格，每行填写：SKU 编码、售价、划线价、库存、SKU 图
- 保存策略：
  - **保存草稿**：`status=DRAFT`，字段校验放宽，仅商家自己可见
  - **提交审核**：`status=PENDING`，完整校验后提交，不可编辑直到审核完成
- API：`POST /api/merchant/products`
  - 校验：类目必须存在且 ACTIVE；SKU 至少 1 条；价格/库存为正整数
  - 写入审计日志 `PRODUCT_CREATED`

#### 4.2 商品编辑与上下架
- 页面：`/merchant/products/[id]/edit`
- 规则：
  - 审核中（PENDING）的商品不可编辑
  - 审核通过（APPROVED）的商品可编辑部分字段（价格、库存、上下架状态），编辑后需重新审核或直接进入待上架（视平台策略，首版采用"编辑价格库存不需重审，编辑主信息需重审"的简化策略，或统一重审）
  - **首版简化**：任何编辑都使商品回到 DRAFT 状态，需重新提交审核
- 上下架：仅 APPROVED 状态商品可操作，`saleStatus=ON_SALE/OFF_SHELF`，不影响审核状态
- API：`PATCH /api/merchant/products/[id]`
- 写入审计日志 `PRODUCT_UPDATED`

#### 4.3 商品列表（商家后台）
- 页面：`/merchant/products`
  - 列表：主图、名称、类目、价格区间、总库存、审核状态、销售状态
  - 筛选：按状态（草稿/审核中/已通过/已驳回）、按销售状态（上架/下架）
  - 操作：编辑、删除（仅 DRAFT 可删）、上架/下架、查看审核驳回原因

#### 4.4 商品审核（平台后台）
- 页面：`/admin/products`
  - 列表：按 PENDING 默认展示，显示商家名、商品名、类目、提交时间
  - 操作：查看详情（含 SKU 明细）、通过、驳回（填原因）
- API：`PATCH /api/admin/products/[id]/review`
  - 权限：`product:review`
  - 通过：`status=APPROVED`，买家端可见（若上架）
  - 驳回：`status=REJECTED`，商家可查看原因并重新编辑提交
  - 写入审计日志 `PRODUCT_REVIEWED`

#### 4.5 商品浏览（买家端）
- 页面：`/` 首页 — 展示上架中的商品卡片（主图、名称、最低价 SKU 价格、店铺名）
- 页面：`/products` 商品列表 — 按类目筛选、按关键词搜索、排序（默认/价格/销量）
- 页面：`/products/[id]` 商品详情 — 主图轮播、SKU 选择器、价格随 SKU 切换、店铺信息入口
- API：`/api/products`、`/api/products/[id]`
  - 只返回 `status=APPROVED` 且 `saleStatus=ON_SALE` 的商品
  - 详情页带 SKU 列表，价格取 SKU 中最低展示
  - 预留 Redis 缓存：商品详情缓存 5 分钟，库存实时读库（避免超卖）

### 5. 文件上传服务

- 实现 `lib/storage.ts`：
  - `saveFile(file: File, folder: string): Promise<string>` — 首版保存到 `public/uploads/${folder}/`，返回相对 URL
  - 预留接口：未来可替换为对象存储（OSS/S3）而不改调用方
- API Route：`/api/upload`（或按角色分 `/api/merchant/upload`、`/api/admin/upload`）
  - 校验文件类型（jpg/png/webp）、大小（单张 ≤ 5MB）
  - 返回可访问 URL

### 6. 服务层实现

按 Phase 1 规范，在 `server/services/` 下新增：

| 服务 | 核心方法 |
| --- | --- |
| `merchant.service.ts` | `createApplication`, `findById`, `findMany`, `update`, `review`, `addStaff`, `findStaffs` |
| `category.service.ts` | `create`, `findTree`, `findById`, `update`, `toggleStatus` |
| `brand.service.ts` | `create`, `findMany`, `findById`, `update`, `toggleStatus` |
| `product.service.ts` | `create`, `findById`, `findMany`, `update`, `delete`, `review`, `toggleSaleStatus` |
| `sku.service.ts` | `createMany`, `updateMany`, `findByProductId` |
| `upload.service.ts` | `saveImage` |

约束：
- 所有金额字段（price、originalPrice）使用整数分
- 库存操作在本阶段只做初始化/编辑，不做扣减（交易阶段实现）
- `product.service.ts` 的 `findMany` 需支持商家隔离（`merchantId` 必填过滤）
- 平台后台查询不做商家过滤，但需关联商家名

### 7. 校验层（Zod）

在 `server/validations/` 下新增：
- `merchant.validation.ts` — 入驻申请、审核操作
- `product.validation.ts` — 商品创建/编辑、SKU 数组、上下架
- `category.validation.ts` — 类目创建/编辑
- `brand.validation.ts` — 品牌创建/编辑

### 8. 权限配置

更新 Seed / 权限初始化：

| 权限 Code | 说明 | 拥有角色 |
| --- | --- | --- |
| `merchant:review` | 商家审核 | PLATFORM_ADMIN |
| `product:review` | 商品审核 | PLATFORM_ADMIN |
| `category:manage` | 类目管理 | PLATFORM_ADMIN |
| `brand:manage` | 品牌管理 | PLATFORM_ADMIN |
| `product:manage` | 商品管理（商家） | MERCHANT_STAFF |
| `staff:manage` | 员工管理（商家店主） | MERCHANT_STAFF（isOwner） |

商家端接口不使用 Permission 码粒度的校验，而使用 **商家资源归属校验**：
- 商家调用 `product.service.ts` 时必须传入当前用户的 `merchantId`
- Service 层在更新/删除/查询时自动附加 `merchantId` 过滤
- 若操作不属于自己的资源，抛出 `ForbiddenError`

### 9. 页面与路由汇总

#### 买家端（`(buyer)/`）
| 路由 | 内容 |
| --- | --- |
| `/` | 首页，商品卡片列表 |
| `/products` | 商品列表，支持搜索/筛选/排序 |
| `/products/[id]` | 商品详情，SKU 选择 |
| `/merchant/apply` | 商家入驻申请页 |

#### 商家后台（`(merchant)/`）
| 路由 | 内容 |
| --- | --- |
| `/merchant` | 概览（本阶段展示店铺状态和商品数统计） |
| `/merchant/products` | 商品列表 |
| `/merchant/products/create` | 发布商品 |
| `/merchant/products/[id]/edit` | 编辑商品 |
| `/merchant/settings` | 店铺资料 |
| `/merchant/settings/staff` | 员工管理 |

#### 平台后台（`(admin)/`）
| 路由 | 内容 |
| --- | --- |
| `/admin/merchants` | 商家审核列表 |
| `/admin/merchants/[id]` | 商家详情 |
| `/admin/products` | 商品审核列表 |
| `/admin/products/[id]` | 商品详情审核 |
| `/admin/categories` | 类目管理 |
| `/admin/brands` | 品牌管理 |

### 10. 缓存策略（Redis）

| Key 模式 | 内容 | TTL |
| --- | --- | --- |
| `product:detail:{id}` | 商品详情（含 SKU 列表） | 300s |
| `category:tree` | 完整类目树 | 600s |
| `brand:list` | 品牌列表 | 600s |

- 商品编辑/审核通过后立即删除对应 `product:detail:{id}`
- 类目/品牌变更后删除对应树缓存

---

## 测试计划

### 单元测试
- `merchant.service.test.ts`：入驻申请、审核状态流转、资源归属隔离
- `product.service.test.ts`：商品创建（含 SKU 生成）、状态流转、商家隔离查询
- `category.service.test.ts`：树形结构查询、父子关系
- `upload.service.test.ts`：文件类型/大小校验

### 集成测试
- 商家入驻申请 → 平台审核通过 → 商家可登录后台
- 商家发布商品（含多 SKU）→ 提交审核 → 平台审核通过 → 买家端可见
- 商家编辑商品 → 回到草稿 → 重新提交审核
- 商家 A 无法查询/编辑商家 B 的商品
- 平台管理员禁用商家后，其商品从买家端消失

### 端到端测试（可选，以手工验证为主）
- 完整链路：买家注册 → 申请商家 → 平台审核 → 发布商品 → 买家浏览商品详情

---

## 风险评估与简化项

| 风险点 | 应对策略 |
| --- | --- |
| 富文本编辑器引入过重 | 首版使用 `<textarea>` 或简单 HTML 输入 |
| 图片存储方案未确定 | 首版本地文件存储，抽象 `lib/storage.ts` 接口，后续无痛迁移对象存储 |
| SKU 矩阵组合爆炸 | 前端限制规格 ≤ 3 组，每组值 ≤ 6 个，即最多 216 个 SKU |
| 商品编辑后是否重审 | 首版统一回到 DRAFT 重新审核，逻辑最简单 |
| 商家员工权限细分 | 首版不做，所有 staff 权限相同，仅区分 isOwner 能否管理员工 |

## 验收标准

1. 新用户可通过 `/merchant/apply` 提交商家入驻申请，上传资质图片
2. 平台管理员可在 `/admin/merchants` 查看申请列表并通过/驳回/禁用
3. 审核通过的商家员工登录后，`session.merchantId` 正确注入，可进入商家后台
4. 商家可在 `/merchant/products/create` 发布商品（含多规格 SKU），保存草稿或提交审核
5. 平台管理员可在 `/admin/products` 审核商品，通过后买家端可见
6. 买家端首页和商品列表只展示 `APPROVED + ON_SALE` 的商品
7. 商品详情页可切换 SKU，价格/库存随 SKU 变化
8. 商家只能操作自己店铺的商品，跨店访问返回 403
9. 所有审核、创建、编辑操作写入 `AuditLog`
10. `npm run lint` 和 `npm run typecheck` 通过
11. 新增 service 有单元测试覆盖

---

## 实施记录

### 2026-06-03 — 商家与商品核心链路

**数据层**
- `prisma/schema.prisma` — 扩展全部 Phase 2 模型（Merchant, MerchantStaff, Category, Brand, Product, Sku）与枚举（MerchantType, MerchantStatus, ProductStatus, ProductSaleStatus, CategoryStatus）
- `prisma/seed.ts` — 新增权限并绑定 PLATFORM_ADMIN，seeded 示例类目树（数码/手机/电脑、服饰/男装/女装）和示例品牌（Apple、华为、Nike）
- 测试账号：`merchant@1shop.local` / `merchant123`（关联"测试店铺"，APPROVED，佣金 5%）

**基础设施**
- `src/lib/storage.ts` — 本地文件存储抽象，预留对象存储迁移接口
- `src/app/api/upload/route.ts` — 图片上传 API，限制 5MB、jpg/png/webp，按角色隔离上传目录

**商家入驻与审核**
- `src/server/services/merchant.service.ts` — 入驻申请、查询、审核、员工管理
- `src/server/validations/merchant.validation.ts`
- `src/server/actions/merchant.actions.ts` / `admin.merchant.actions.ts`
- `src/app/merchant/apply/page.tsx` — 入驻申请页（资质图片上传）
- `src/app/admin/merchants/page.tsx` — 审核列表（状态筛选、搜索、分页）
- `src/app/admin/merchants/[id]/page.tsx` — 详情审核页（通过/驳回/禁用）

**类目与品牌管理**
- `src/server/services/category.service.ts` / `brand.service.ts` — CRUD + 树形查询 + 启用/禁用
- `src/server/validations/category.validation.ts` / `brand.validation.ts`
- `src/server/actions/admin.category.actions.ts` / `admin.brand.actions.ts`
- `src/app/admin/categories/page.tsx` — 类目树形展示与新增
- `src/app/admin/brands/page.tsx` — 品牌列表与新增

**商品系统**
- `src/server/services/product.service.ts` — 创建、查询、更新、删除、审核、上下架，商家隔离
- `src/server/services/sku.service.ts` — SKU 批量创建与查询
- `src/server/validations/product.validation.ts`
- `src/server/actions/merchant.product.actions.ts` — 商家商品操作（创建/更新/上下架/删除）
- `src/server/actions/admin.product.actions.ts` — 平台审核
- `src/app/merchant/products/page.tsx` — 商品列表
- `src/app/merchant/products/create/page.tsx` — 发布商品
- `src/app/merchant/products/[id]/edit/page.tsx` — 编辑商品
- `src/app/merchant/products/_components/product-form.tsx` — 商品表单（规格模板、SKU 矩阵自动生成、图片上传）
- `src/app/admin/products/page.tsx` — 审核列表
- `src/app/admin/products/[id]/page.tsx` — 详情审核页

**买家端浏览**
- `src/app/index/page.tsx` — 首页商品卡片列表
- `src/app/products/page.tsx` — 商品列表（类目筛选、搜索）
- `src/app/products/[id]/page.tsx` + `product-detail-client.tsx` — 商品详情（SKU 选择器、价格/库存联动）

**Session 与登录**
- `auth.service.ts` — MERCHANT_STAFF 登录时自动查询 `MerchantStaff` 表注入 `merchantId` 到 Session

**验证结果**（2026-06-03）
- `npm run typecheck` 通过 | `npm run lint` 通过（0 errors）| `npm test` 通过（22/22）

---

### 2026-06-04 — 买家端账号体系 + 身份表拆分架构重构

**1. 身份表拆分——移除 User.kind**

核心变更：删除 `User.kind` 枚举字段，改为三张身份详情表各自管理。

| 表 | 说明 |
| --- | --- |
| `User` | 买家+商家统一认证表，删除 `kind` 字段和 `UserKind` 枚举 |
| `BuyerProfile` (新建) | 买家身份详情：`passwordHash`（买家端密码）、`displayName`（昵称） |
| `MerchantStaff` (已有) | 商家员工：新增 `displayName`（员工昵称） |
| `PlatformAdmin` (新建) | 平台管理员独立认证表：`email`、`passwordHash`、`displayName`、`avatar`，不与 User 共享 |

登录判断：
- 买家端：查 User 表，无门槛。`loginWithPassword` 验证 `BuyerProfile.passwordHash`
- 商家端：查 User 表 + `MerchantStaff` 关联。`loginAsMerchant` 验证 `User.passwordHash`
- 管理端：查 `PlatformAdmin` 表，完全独立。`loginAsAdmin`

**2. 密码三端隔离**

| 端 | 密码存储位置 |
| --- | --- |
| 买家 | `BuyerProfile.passwordHash` |
| 商家 | `User.passwordHash` |
| 管理 | `PlatformAdmin.passwordHash` |

**3. 员工转买家流程**

`registerUser` 处理三种情况：
- User 不存在 → 创建 User + BuyerProfile（密码存 BuyerProfile）
- User 存在但无 BuyerProfile（被添加为员工后首次注册买家）→ 创建 BuyerProfile（不覆盖 User.passwordHash，保留员工登录密码）
- User 存在且有 BuyerProfile → 拒绝"已注册"

`loginByPhone` 对已有 User 自动创建 BuyerProfile（若缺失）。

`addStaffAction` 对已有 User 补设 `User.passwordHash = "123456"`（若为空）。

**4. 买家端注册与登录**

| 文件 | 内容 |
| --- | --- |
| `src/server/services/auth.service.ts` | `registerUser`、`loginByPhone`、`loginWithPassword`（买家）、`loginAsMerchant`（商家）、`loginAsAdmin`（管理）、`sendLoginSmsCode`（Redis 限流：60s冷却、5次/日、已有验证码重发不累计次数、登录成功清除当日计数） |
| `src/server/actions/auth.actions.ts` | `registerAction`、`phoneLoginAction`、`buyerLoginAction`、`merchantLoginAction`、`adminLoginAction`、`sendSmsCodeAction` |
| `src/server/actions/merchant.staff.actions.ts` | `addStaffAction` 移除 kind 检查，自动分配 MERCHANT_STAFF 角色，设置 MerchantStaff.displayName |
| `src/lib/sms.ts` | 短信抽象层，开发环境 console.log 输出，预留生产 SDK 接入点 |
| `src/app/index/login/page.tsx` | 双 Tab 登录页："手机登录"（默认）/"账号密码登录" |
| `src/app/index/register/page.tsx` | 统一注册页，单表单无 Tab |

**5. 用户中心**

| 文件 | 内容 |
| --- | --- |
| `src/app/index/user/page.tsx` | 服务端入口，查询 User + BuyerProfile 展示数据（含 hasPassword） |
| `src/app/index/user/user-center-client.tsx` | 侧边栏三 Tab：个人资料（头像上传+昵称编辑）、账号安全（邮箱绑定/更换、手机号绑定/更换、密码设置/修改——首次设置无原密码验证）、收货地址 CRUD |
| `src/server/services/address.service.ts` | 收货地址 CRUD + 设默认 |

**6. 导航栏与头像**

- `src/components/layout-nav-shell.tsx` — 买家端导航栏：圆形头像（上传图片 → 实心黑色小人SVG默认）+ 右侧昵称。`/index/login` 和 `/index/register` 不显示导航
- `src/app/merchant/_components/merchant-layout-client.tsx` — 商家端导航栏：圆形头像 + 昵称
- 默认头像：实心填充小人 SVG（`fill="#333"`），背景 `#e8e8e8`
- 昵称默认值：买家 `用户{手机尾号4位}`，员工 `员工{手机尾号4位}`

**7. Session 管理**

- JWT payload：`{ sub, end, roles, merchantId? }`
- `SessionUser`：`{ userId, end, roles, merchantId?, avatar?, displayName? }`
- `getSessionUser()`：按 `end` 查不同表获取 avatar/displayName（商家→MerchantStaff、买家→BuyerProfile、管理→PlatformAdmin），缺失时返回 null（自动登出）
- Cookie 按 end 拆分：`session` (BUYER)、`session.merchant` (MERCHANT_STAFF)、`session.admin` (PLATFORM_ADMIN)
- `cookieConfigForEnd()` 映射 end→cookie 名称

**8. 数据模型扩展**

- `prisma/schema.prisma` — 新增 `BuyerProfile`、`PlatformAdmin`；删除 `UserKind` 枚举和 `User.kind`；`MerchantStaff` 新增 `displayName`
- `prisma/seed.ts` — 三端种子数据：admin→PlatformAdmin、merchant→User+MerchantStaff（displayName:"测试商家"）、buyer→User+BuyerProfile（displayName:"测试买家"）
- `src/lib/types.ts` — `LoginEnd` 字符串联合类型替代 `UserKind`，`SessionPayload.end` 替代 `.kind`

**验证结果**（2026-06-04）
- `npx tsc --noEmit` — 零错误
- `prisma migrate dev` — 两次迁移（remove_user_kind + add_display_name_to_profiles）已应用
- `prisma db seed` — 通过

---

## 与后续阶段的衔接

- **Phase 3 交易闭环**依赖本阶段产出：
  - `Sku.price`、`Sku.stock` 用于下单时的价格计算和库存锁定
  - `Product.saleStatus` 用于判断商品是否可售
  - `Merchant.commissionRate` 用于订单拆单后的佣金计算
  - `MerchantStaff` 用于商家发货时的操作人记录
- 本阶段预留但不下单实现：
  - SKU `salesCount` 初始化为 0，真实销量统计在交易完成后更新
  - 商品搜索只做基础按名称匹配，全文搜索/ES 在后续阶段评估
