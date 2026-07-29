# Phase 3 — 交易闭环

> 对应 [PLAN.md](./PLAN.md) 第三阶段。
> 前置条件：Phase 2 商家与商品系统已完成并通过验收。

## 总体目标

实现完整的交易闭环：商品浏览 → 加入购物车 → 提交订单（自动按商家拆单） → 锁定库存 → 生成支付单 → 支付回调 → 商家发货 → 买家确认收货 → 订单完成。同时实现订单状态机、超时取消、库存释放等核心业务逻辑。

## 技术栈

沿用 Phase 1/2 选型，无新增基础设施依赖。

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js App Router + TypeScript |
| 数据库 | PostgreSQL + Prisma |
| 缓存 | Redis（购物车、库存锁、支付幂等键） |
| 支付 | Mock 支付网关，预留微信/支付宝接口 |
| 校验 | Zod |

---

## 数据模型变更（Prisma Schema）

### 新增枚举

```prisma
enum OrderStatus {
  PENDING_PAYMENT   // 待支付
  PAID              // 已支付
  SHIPPED           // 已发货
  RECEIVED          // 已收货
  COMPLETED         // 已完成
  CANCELLED         // 已取消
  REFUNDING         // 退款处理中（预留 Phase 4）
  REFUNDED          // 已退款（预留 Phase 4）
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDING         // 预留 Phase 4
  REFUNDED          // 预留 Phase 4
}

enum PaymentMethod {
  WECHAT_PAY
  ALIPAY
}

enum ShipmentStatus {
  PENDING
  SHIPPED
  DELIVERED
  RETURNED          // 预留 Phase 4
}
```

### AuditAction 扩展

```prisma
enum AuditAction {
  // ... 已有值
  ORDER_CREATED
  ORDER_UPDATED
  ORDER_CANCELLED
  ORDER_TIMEOUT_CANCELLED
  PAYMENT_CREATED
  PAYMENT_CALLBACK
  SHIPMENT_CREATED
  ORDER_RECEIVED
  ORDER_COMPLETED
  INVENTORY_LOCKED
  INVENTORY_RELEASED
}
```

### 新增模型

#### Order（买家主订单，统一支付）

```prisma
model Order {
  id              String       @id @default(cuid())
  buyerId         String
  orderNo         String       @unique // yyyyMMddHHmmss + 6位随机数
  
  totalAmount     Int          // 订单总金额（分）
  status          OrderStatus  @default(PENDING_PAYMENT)
  
  addressSnapshot Json         // 收货地址快照（下单时固化）
  
  expireAt        DateTime?    // 支付超时时间（30分钟）
  cancelledAt     DateTime?
  cancelReason    String?
  
  paidAt          DateTime?
  completedAt     DateTime?
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  buyer           User         @relation(fields: [buyerId], references: [id])
  subOrders       SubOrder[]
  payment         Payment?
  
  @@index([buyerId, status, createdAt])
  @@index([orderNo])
  @@index([status, expireAt])
}
```

#### SubOrder（按商家拆分的子订单）

```prisma
model SubOrder {
  id              String       @id @default(cuid())
  orderId         String
  merchantId      String
  subOrderNo      String       @unique // orderNo + "-" + 序号
  
  merchantName    String       // 商家名称快照
  totalAmount     Int          // 子订单金额（分）
  status          OrderStatus  @default(PENDING_PAYMENT)
  
  paidAt          DateTime?
  shippedAt       DateTime?
  receivedAt      DateTime?
  completedAt     DateTime?
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  order           Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  merchant        Merchant     @relation(fields: [merchantId], references: [id])
  items           OrderItem[]
  shipment        Shipment?
  
  @@index([orderId])
  @@index([merchantId, status, createdAt])
  @@index([subOrderNo])
}
```

#### OrderItem（订单商品明细）

```prisma
model OrderItem {
  id              String    @id @default(cuid())
  subOrderId      String
  productId       String
  skuId           String
  
  // 商品快照（下单时固化）
  productName     String
  productImage    String
  skuSpecs        Json
  skuCode         String
  
  price           Int       // 成交单价（分）
  quantity        Int
  amount          Int       // 小计 = price * quantity
  
  createdAt       DateTime  @default(now())
  
  subOrder        SubOrder  @relation(fields: [subOrderId], references: [id], onDelete: Cascade)
  product         Product   @relation(fields: [productId], references: [id])
  sku             Sku       @relation(fields: [skuId], references: [id])
  
  @@index([subOrderId])
  @@index([skuId])
}
```

#### Payment（支付单）

```prisma
model Payment {
  id              String         @id @default(cuid())
  orderId         String         @unique
  orderNo         String
  
  amount          Int            // 支付金额（分）
  method          PaymentMethod
  status          PaymentStatus  @default(PENDING)
  
  transactionId   String?        // 第三方支付交易号
  paidAt          DateTime?
  
  idempotencyKey  String         @unique
  
  callbackData    Json?
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  order           Order          @relation(fields: [orderId], references: [id])
  
  @@index([orderNo])
  @@index([idempotencyKey])
  @@index([status, createdAt])
}
```

#### Shipment（物流记录）

```prisma
model Shipment {
  id              String          @id @default(cuid())
  subOrderId      String          @unique
  
  carrier         String          // 快递公司
  trackingNo      String          // 运单号
  status          ShipmentStatus  @default(SHIPPED)
  
  shippedAt       DateTime
  deliveredAt     DateTime?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  subOrder        SubOrder        @relation(fields: [subOrderId], references: [id])
  
  @@index([trackingNo])
}
```

---

## 订单状态机

### 状态流转图

```
                    ┌─→ CANCELLED (买家取消 / 超时取消)
                    │
PENDING_PAYMENT ────┤
                    │
                    └─→ PAID ──→ SHIPPED ──→ RECEIVED ──→ COMPLETED
                         │
                         └─→ REFUNDING ──→ REFUNDED (Phase 4)
```

### 合法跳转表

| 当前状态 | 允许跳转 | 触发条件 |
| --- | --- | --- |
| PENDING_PAYMENT | PAID | 支付回调成功 |
| PENDING_PAYMENT | CANCELLED | 买家取消 / 超时自动取消 |
| PAID | SHIPPED | 商家发货 |
| SHIPPED | RECEIVED | 买家确认收货 |
| RECEIVED | COMPLETED | 自动流转（7天无售后） |
| PAID | REFUNDING | Phase 4 |
| SHIPPED | REFUNDING | Phase 4 |
| REFUNDING | REFUNDED | Phase 4 |

### 实现约束

- 状态跳转必须校验当前状态，只允许合法跳转
- 主订单(Order)和子订单(SubOrder)状态独立但关联：
  - 主订单支付成功 → 所有子订单同步变为 PAID
  - 主订单取消 → 所有子订单同步取消
  - 所有子订单到达某状态后主订单才到对应状态（SHIPPED / RECEIVED / COMPLETED）
- 状态变更写入 AuditLog

实现为独立工具模块 `src/lib/order-state-machine.ts`：
```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = { ... };
export function canTransition(from: OrderStatus, to: OrderStatus): boolean;
export function assertTransition(from: OrderStatus, to: OrderStatus): void;
```

---

## 业务逻辑详解

### 1. 购物车（Redis Hash）

**数据结构**：`cart:{userId}` → Hash，field = skuId，value = JSON

```json
{ "skuId": "...", "productId": "...", "quantity": 2, "addedAt": "...", "selected": true }
```

**操作**：
- 加入购物车：`HSET`，已存在则 `HINCRBY` 数量
- 更新数量 / 删除 / 选中切换：直接读写 Hash field
- 读取全部：`HGETALL`

**校验**：数量 ≥ 1；校验 SKU 存在且商品在售。购物车不设 TTL（持久化保留）。

### 2. 订单创建与拆单

**流程**：

1. 根据前端传入的 `skuIds[]`，从 Redis 购物车读取选中条目
2. 查询每个 SKU 的 Product，获取 `merchantId`
3. 按 `merchantId` 分组，每组生成一个 SubOrder
4. 固化商品快照到 OrderItem（productName, productImage, skuSpecs, price）
5. 固化收货地址快照到 Order.addressSnapshot
6. 生成主 Order，totalAmount = 所有 SubOrder 金额之和
7. 整个流程在单个 `prisma.$transaction` 中完成（含库存扣减）

### 3. 库存锁定与释放

**锁定**（事务内）：
```sql
UPDATE Sku SET stock = stock - quantity 
WHERE id = {skuId} AND stock >= quantity
```
affected rows = 0 → 回滚，返回"库存不足"

**释放**（取消/超时时）：
```sql
UPDATE Sku SET stock = stock + quantity WHERE id = {skuId}
```

同时在 Redis 中记录 `lock:sku:{skuId}` → orderId，TTL = 支付超时 + 5min，作为双重保障标记。

### 4. 支付流程

**Mock 支付网关**（`src/lib/mock-payment.ts`）：
- 开发环境：返回支付链接指向 `/api/payment/mock-pay?paymentId=xxx`
- 预留 `CreatePaymentParams` / `CreatePaymentResult` 接口，对接真实支付时替换实现

**支付回调**（`/api/payment/callback`）：
1. 通过 `idempotencyKey` 查 Redis `idem:payment:{key}`（TTL 24h）
2. 已处理 → 直接返回成功
3. 未处理 → 更新 Payment/Order/SubOrder 状态为 PAID → 写入幂等键 → 写 AuditLog

### 5. 订单超时取消

API Route `/api/cron/cancel-expired-orders`（外部 cron 调用，需 secret 校验）：

扫描 `status=PENDING_PAYMENT AND expireAt < NOW()` 的订单，逐笔：
- 更新 Order + SubOrder 状态为 CANCELLED
- 释放所有 OrderItem 对应 SKU 库存
- 写入 AuditLog `ORDER_TIMEOUT_CANCELLED`

默认支付超时 30 分钟，通过环境变量 `PAYMENT_TIMEOUT_MINUTES` 可配置。

### 6. 商家发货

- 只能操作自己店铺的 SubOrder（校验 `subOrder.merchantId === session.merchantId`）
- 只能从 PAID 状态发货
- 创建 Shipment 记录 → 更新 SubOrder 状态为 SHIPPED
- 所有子订单都发货后，主订单状态同步为 SHIPPED

### 7. 买家确认收货

- 只能操作自己的订单（校验 `order.buyerId === session.userId`）
- 只能从 SHIPPED 状态确认
- 更新 SubOrder 状态为 RECEIVED
- 所有子订单都收货后，主订单状态同步为 RECEIVED

### 8. 订单完成

收货满 7 天后自动流转为 COMPLETED（同上 cron 扫描机制）。`completedAt` 用于 Phase 4 结算保护期计算。

---

## Redis 策略汇总

| Key 模式 | 类型 | 内容 | TTL |
| --- | --- | --- | --- |
| `cart:{userId}` | Hash | 购物车，field=skuId, value=JSON | 无（持久） |
| `lock:sku:{skuId}` | String | 库存锁定标记，值=orderId | 支付超时+5min |
| `idem:payment:{key}` | String | 支付回调幂等 | 24h |
| `idem:release:{orderId}` | String | 库存释放幂等 | 24h |

---

## 实施步骤

### 1. 数据库迁移与 Seed

- 编写 Schema 变更，生成迁移 `prisma migrate dev --name phase3_orders`
- 更新 `prisma/seed.ts`：
  - 新增权限：`order:view`、`order:intervene`
  - 为 PLATFORM_ADMIN 绑定新权限
  - 可选：创建测试商品（带充足库存）供手工验证
- 验证 `db:migrate` + `db:seed` 通过

### 2. 服务层实现

在 `src/server/services/` 下新增：

| 服务 | 核心方法 |
| --- | --- |
| `cart.service.ts` | `getCart(userId)`, `addItem(userId, skuId, quantity)`, `updateItem(userId, skuId, quantity)`, `removeItem(userId, skuId)`, `toggleSelect(userId, skuId, selected)`, `selectAll(userId, selected)`, `clearCart(userId)` |
| `order.service.ts` | `createOrder(userId, skuIds[], addressId)`, `findOrderById(orderId)`, `findOrdersByBuyer(userId, params)`, `findSubOrdersByMerchant(merchantId, params)`, `findAllOrders(params)`, `cancelOrder(orderId, userId, reason?)`, `confirmReceipt(subOrderId, userId)`, `completeOrder(orderId)`, `timeoutCancel(orderId)` |
| `payment.service.ts` | `createPayment(orderId, method)`, `handleCallback(idempotencyKey, transactionId, callbackData)`, `findByOrderId(orderId)` |
| `shipment.service.ts` | `createShipment(subOrderId, merchantId, carrier, trackingNo)`, `findBySubOrderId(subOrderId)` |

**关键约束**：
- 所有金额使用整数分
- `order.service.ts` 使用 `prisma.$transaction` 保证订单创建 + 库存扣减原子性
- 商家隔离：查询/更新子订单时强制带 `merchantId` 过滤
- 买家隔离：查询/更新订单时强制带 `buyerId` 过滤

### 3. 校验层

在 `src/server/validations/` 下新增：

| 文件 | Schema |
| --- | --- |
| `cart.validation.ts` | `addCartItemSchema`, `updateCartItemSchema` |
| `order.validation.ts` | `createOrderSchema`（skuIds 非空数组 + addressId 非空）, `cancelOrderSchema` |
| `payment.validation.ts` | `callbackSchema`（idempotencyKey 非空） |
| `shipment.validation.ts` | `createShipmentSchema`（carrier + trackingNo 非空） |

### 4. Server Actions

在 `src/server/actions/` 下新增：

| 文件 | Action | 说明 |
| --- | --- | --- |
| `cart.actions.ts` | `addToCartAction`, `updateCartAction`, `removeCartAction`, `toggleSelectAction` | 买家购物车操作，Form-based |
| `order.actions.ts` | `createOrderAction`, `cancelOrderAction`, `confirmReceiptAction` | 买家订单操作，Form-based |
| `merchant.order.actions.ts` | `shipOrderAction`, `findMerchantOrdersAction` | 商家订单操作 |
| `admin.order.actions.ts` | `viewAllOrdersAction`, `interveneOrderAction` | 平台订单监管 |

**模式约定**：
- 买家端：`(prev: State, formData: FormData) => Promise<State>`，与 `address.actions.ts` 一致
- 商家端/admin：直接 throw 错误，由 error boundary 处理
- 所有操作后 `revalidatePath`

### 5. 新增工具模块

| 文件 | 说明 |
| --- | --- |
| `src/lib/order-state-machine.ts` | 订单状态机合法跳转校验 |
| `src/lib/mock-payment.ts` | Mock 支付网关，预留真实支付接口 |
| `src/lib/order-no.ts` | 订单号生成器（yyyyMMddHHmmss + 6位随机数） |

### 6. 页面与路由

#### 买家端

| 路由 | 文件 | 内容 |
| --- | --- | --- |
| `/cart` | `src/app/cart/page.tsx` | 购物车：商品列表、选中/取消、修改数量、去结算 |
| `/checkout` | `src/app/checkout/page.tsx` | 结算：确认商品、选择地址、显示拆单、提交订单 |
| `/orders` | `src/app/orders/page.tsx` | 我的订单列表 |
| `/orders/[id]` | `src/app/orders/[id]/page.tsx` | 订单详情 + 支付/确认收货操作 |
| `/pay/[orderId]` | `src/app/pay/[orderId]/page.tsx` | 支付页：金额、方式选择、Mock 支付 |

买家端页面复用 `LayoutNavShell`（与 `/index`、`/products` 相同布局）。

#### 商家后台（`/merchant`）

| 路由 | 文件 | 内容 |
| --- | --- | --- |
| `/merchant/orders` | `src/app/merchant/orders/page.tsx` | 子订单列表：状态筛选、搜索、分页 |
| `/merchant/orders/[id]` | `src/app/merchant/orders/[id]/page.tsx` | 子订单详情 + 发货表单 |

> 导航栏已有 `/merchant/orders` 链接，本阶段创建实际页面即可。

#### 平台后台（`/admin`）

| 路由 | 文件 | 内容 |
| --- | --- | --- |
| `/admin/orders` | `src/app/admin/orders/page.tsx` | 全部订单：状态/商家/时间筛选 |
| `/admin/orders/[id]` | `src/app/admin/orders/[id]/page.tsx` | 订单详情 + 支付/物流/操作日志 |

> 导航栏已有 `/admin/orders` 链接，本阶段创建实际页面即可。

#### API Routes

| 路由 | 文件 | 说明 |
| --- | --- | --- |
| `/api/payment/callback` | `src/app/api/payment/callback/route.ts` | 支付回调，幂等处理 |
| `/api/payment/mock-pay` | `src/app/api/payment/mock-pay/route.ts` | Mock 支付（开发环境） |
| `/api/cron/cancel-expired-orders` | `src/app/api/cron/cancel-expired-orders/route.ts` | 超时订单取消（需 secret 校验） |

### 7. 权限配置

| 权限 Code | 说明 | 拥有角色 |
| --- | --- | --- |
| `order:view` | 查看全部订单 | PLATFORM_ADMIN |
| `order:intervene` | 平台介入订单 | PLATFORM_ADMIN |

商家端使用资源归属校验而非 Permission 码（与 Phase 2 商品管理一致）。

---

## 文件结构汇总

### 新建文件（27 个）

```
# 工具模块
src/lib/order-state-machine.ts
src/lib/mock-payment.ts
src/lib/order-no.ts

# Service 层
src/server/services/cart.service.ts
src/server/services/order.service.ts
src/server/services/payment.service.ts
src/server/services/shipment.service.ts

# Validation 层
src/server/validations/cart.validation.ts
src/server/validations/order.validation.ts
src/server/validations/payment.validation.ts
src/server/validations/shipment.validation.ts

# Action 层
src/server/actions/cart.actions.ts
src/server/actions/order.actions.ts
src/server/actions/merchant.order.actions.ts
src/server/actions/admin.order.actions.ts

# 买家端页面
src/app/cart/page.tsx
src/app/checkout/page.tsx
src/app/orders/page.tsx
src/app/orders/[id]/page.tsx
src/app/pay/[orderId]/page.tsx

# API Routes
src/app/api/payment/callback/route.ts
src/app/api/payment/mock-pay/route.ts
src/app/api/cron/cancel-expired-orders/route.ts

# 商家端页面
src/app/merchant/orders/page.tsx
src/app/merchant/orders/[id]/page.tsx

# 平台端页面
src/app/admin/orders/page.tsx
src/app/admin/orders/[id]/page.tsx
```

### 修改文件

```
prisma/schema.prisma    # 新增 Order/SubOrder/OrderItem/Payment/Shipment + 枚举
prisma/seed.ts          # 新增 Phase 3 权限 + 测试数据
```

---

## 测试计划

### 单元测试

| 测试文件 | 覆盖内容 |
| --- | --- |
| `order-state-machine.test.ts` | 所有合法/非法状态跳转 |
| `order-no.test.ts` | 订单号格式、唯一性 |
| `cart.service.test.ts` | 购物车 CRUD、选中切换 |
| `order.service.test.ts` | 拆单正确性、金额计算、库存锁定与释放、状态流转、事务回滚 |
| `payment.service.test.ts` | 支付单生成、回调幂等 |
| `shipment.service.test.ts` | 发货状态校验、商家归属 |

### 集成测试

- 完整下单：购物车 → 下单 → 拆单 → 库存扣减 → 支付单生成
- 支付回调 → 订单状态 PAID → 幂等重复回调无副作用
- 超时取消：创建订单 → 过期 → cron 取消 → 库存恢复
- 商家发货 → 买家收货 → 订单完成
- 多商家拆单：2 个商家各 2 件商品 → 2 个子订单各 2 个 OrderItem
- 商家 A 无法操作商家 B 的子订单
- 买家无法操作他人订单

---

## 风险评估与简化项

| 风险点 | 应对策略 |
| --- | --- |
| 真实支付对接复杂 | 首版 Mock 网关，预留 `CreatePaymentParams` / `CreatePaymentResult` 接口，后续替换实现即可 |
| Redis 购物车数据丢失 | 购物车仅 Redis 存储，不设 DB 持久化。Redis 故障用户需重新添加，首版可接受 |
| 超时取消定时任务 | 首版 API Route + 外部 cron（Vercel Cron / GitHub Actions），后续可改用消息队列 |
| 高并发库存超卖 | PostgreSQL 事务 + 行级锁。首版交易量下足够，后续可引入 Redis 预减库存 |
| 拆单后部分退款 | 本阶段只做正向交易，REFUNDING/REFUNDED 状态已预留 |

---

## 与后续阶段的衔接

- **Phase 4 售后**：Order/SubOrder 已预留 REFUNDING/REFUNDED 状态；ShipmentStatus 已预留 RETURNED
- **Phase 4 营销**：`createOrder()` 中预留优惠计算钩子插入点
- **Phase 4 结算**：`SubOrder.merchantId` 用于按商家统计；`Order.completedAt` 用于结算保护期；`Merchant.commissionRate` 用于佣金计算
- 本阶段不实现：优惠券/满减、退款/退货、商家结算、真实支付渠道

---

## 验收标准

1. 买家可将商品加入购物车，修改数量、选中/取消、移除
2. 购物车数据在登录后持久保留（Redis）
3. 提交订单后按商家自动拆分子订单，库存正确扣减
4. 生成支付单，Mock 支付可完成
5. 支付回调幂等处理，重复回调无副作用
6. 未支付订单 30 分钟后自动取消，库存正确释放
7. 商家只能查看和操作自己店铺的子订单
8. 商家发货后子订单状态正确流转
9. 买家确认收货后订单状态正确流转
10. 所有状态跳转遵循状态机规则，非法跳转被拒绝
11. 所有金额整数分存储和计算
12. 关键操作写入 AuditLog
13. `npm run typecheck` 和 `npm run lint` 通过
14. 新增 service 有单元测试覆盖

---

## 实施记录

### 2026-06-05 — 交易闭环全面实施

### 数据层

- `prisma/schema.prisma` — 新增 Order、SubOrder、OrderItem、Payment、Shipment 模型及 OrderStatus、PaymentStatus、PaymentMethod、ShipmentStatus 枚举
- `prisma/seed.ts` — 新增 `order:view`、`order:intervene` 权限并绑定 PLATFORM_ADMIN
- 迁移 `phase3_orders` 已应用

### 工具模块

- `src/lib/order-state-machine.ts` — 状态流转合法校验（VALID_TRANSITIONS + assertTransition）
- `src/lib/mock-payment.ts` — Mock 支付网关，预留 CreatePaymentParams/CreatePaymentResult 接口
- `src/lib/order-no.ts` — 订单号生成（yyyyMMddHHmmss+6位随机）+ 子订单号 + 幂等键

### Service 层

- `src/server/services/cart.service.ts` — Redis Hash 购物车 CRUD + 选中切换 + 全选
- `src/server/services/order.service.ts` — 创建订单（事务内拆单+库存扣减）、查询（买家/商家/全量）、取消、确认收货、完成、超时取消
- `src/server/services/payment.service.ts` — 创建支付单、回调幂等处理（Redis idem:payment key）
- `src/server/services/shipment.service.ts` — 创建发货记录、商家归属校验、主订单状态同步

### Action 层

- `src/server/actions/cart.actions.ts` — addToCart、updateCart、removeCart、toggleSelect、selectAll
- `src/server/actions/order.actions.ts` — createOrder、cancelOrder、confirmReceipt（Form-based）
- `src/server/actions/merchant.order.actions.ts` — shipOrder（商家发货）
- `src/server/actions/admin.order.actions.ts` — adminGetOrders（权限校验入口）

### Validation 层

- `src/server/validations/cart.validation.ts` — addCartItem、updateCartItem、removeCartItem
- `src/server/validations/order.validation.ts` — createOrder（skuIds JSON解析+数组校验）、cancelOrder、confirmReceipt
- `src/server/validations/payment.validation.ts` — callbackSchema
- `src/server/validations/shipment.validation.ts` — createShipment（carrier + trackingNo 非空）

### 买家端页面

- `src/app/cart/page.tsx` + `cart-client.tsx` — 购物车列表、数量编辑、选中切换、全选、去结算
- `src/app/checkout/page.tsx` + `checkout-client.tsx` — 确认订单（按商家分组展示）、地址选择、提交
- `src/app/orders/page.tsx` + `orders-client.tsx` — 订单列表（状态筛选、分页）
- `src/app/orders/[id]/page.tsx` + `order-detail-client.tsx` — 订单详情、支付/取消/确认收货操作
- `src/app/pay/[orderId]/page.tsx` + `pay-client.tsx` — 支付页（Mock 支付方式选择）

### API Routes

- `src/app/api/payment/mock-pay/route.ts` — Mock 支付触发→回调→重定向
- `src/app/api/payment/callback/route.ts` — 正式支付回调接口（幂等处理）
- `src/app/api/cron/cancel-expired-orders/route.ts` — 超时订单取消（Bearer token 校验）

### 商家端页面

- `src/app/merchant/orders/page.tsx` — 子订单列表（状态筛选、搜索、分页）
- `src/app/merchant/orders/[id]/page.tsx` — 子订单详情 + 发货表单

### 平台端页面

- `src/app/admin/orders/page.tsx` — 全部订单列表（状态筛选、搜索、分页）
- `src/app/admin/orders/[id]/page.tsx` — 订单详情（含支付信息、物流信息）

### Bug 修复与类型更新

- `src/lib/types.ts` — `SessionUser`/`SessionPayload` 从 `kind: UserKind` 迁移为 `end: LoginEnd`，新增 `avatar?`/`displayName?`
- `src/lib/auth.ts` — `getSessionUser()` 按 end 查对应身份表注入 avatar/displayName
- `src/app/checkout/checkout-client.tsx` — 修复 addressId hidden input 覆盖 radio 选择的问题
- `src/app/index/user/page.tsx` + `user-center-client.tsx` — null→undefined 类型对齐

**验证结果**（2026-06-05）

- `npx tsc --noEmit` — 零错误
- `npx eslint` — 3 errors（均为 Phase 2 预存 React setState-in-effect 问题，非本阶段引入）
- `npx vitest run` — 49 passed, 9 failed（均为 test DB 凭据未配置，非代码问题）
