# 商家入驻与审核测试用例

## 前置条件

- 平台管理员账号：`admin@1shop.local` / `admin123`
- 数据库已 seed，类目/品牌数据正常

---

## 用例 1：未登录用户申请入驻

**步骤**
1. 访问 `/merchant/apply`（无需登录）
2. 填写表单：
   - 店铺名称：`测试审核店铺`
   - 商家类型：`企业`
   - 联系人姓名：`张三`
   - 联系人手机：`13900139001`
   - 联系人邮箱：`zhangsan@test.com`
   - 登录密码：`test1234`
3. 点击"提交入驻申请"

**预期结果**
- 页面提示"申请已提交"
- 数据库 `Merchant` 表新增一条记录，`status = PENDING`
- 数据库 `User` 表新增一条记录，`email = zhangsan@test.com`，`phone = 13900139001`，`kind = MERCHANT_STAFF`
- 数据库 `MerchantStaff` 表新增关联记录，`isOwner = true`

---

## 用例 2：平台管理员查看待审核列表

**步骤**
1. 访问 `/admin/login`，使用 `admin@1shop.local` / `admin123` 登录
2. 进入 `/admin/merchants`
3. 筛选状态为"待审核"

**预期结果**
- 列表展示刚提交的"测试审核店铺"
- 显示店铺名称、商家类型、联系人、提交时间

---

## 用例 3：平台管理员审核通过

**步骤**
1. 在 `/admin/merchants` 列表中点击"测试审核店铺"
2. 进入详情页 `/admin/merchants/{id}`
3. 点击"通过"

**预期结果**
- 商家状态变为 `APPROVED`
- 页面提示或通过反馈可见状态变更
- `reviewedAt`、`reviewedBy` 字段被填充
- 商家员工可使用 `zhangsan@test.com` / `test1234` 或 `13900139001` / `test1234` 登录商家后台

---

## 用例 4：平台管理员审核驳回

**步骤**
1. 重新执行用例 1，创建新申请（店铺名：`测试驳回店铺`，手机：`13900139002`）
2. 平台管理员进入 `/admin/merchants`
3. 点击该店铺详情
4. 点击"驳回"，填写原因：`营业执照不清晰`

**预期结果**
- 商家状态变为 `REJECTED`
- `rejectionReason` 字段值为 `营业执照不清晰`
- 商家员工尝试登录时提示"店铺尚未通过审核"

---

## 用例 5：审核通过后商家登录并访问后台

**步骤**
1. 访问 `/merchant/login`
2. 输入账号 `13900139001`，密码 `test1234`
3. 点击登录

**预期结果**
- 登录成功，跳转 `/merchant`
- 页面展示商家后台（商品管理、订单管理等导航）
- 店铺设置 `/merchant/settings/staff` 可正常访问

---

## 用例 6：已登录买家申请入驻（自动关联）

**步骤**
1. 先注册/登录一个买家账号（如用邮箱 `buyer@test.com` 注册）
2. 访问 `/merchant/apply`
3. 填写表单（店铺名：`买家转商家店`，手机用新号）
4. 不填密码（或随意填，应被忽略）
5. 提交

**预期结果**
- 申请提交成功
- 该买家账号的 `User.kind` 被更新为 `MERCHANT_STAFF`
- 新创建的商家与该买家账号自动关联（`MerchantStaff.userId` 指向该买家）
- 不会创建新的 User 账号

---

## 快速数据准备（Seed 脚本）

如需在数据库中直接创建待审核商家用于测试，可在 `prisma/seed.ts` 中追加：

```ts
await prisma.user.upsert({
  where: { email: "pending@test.com" },
  update: {},
  create: {
    email: "pending@test.com",
    phone: "13900139003",
    passwordHash: await bcrypt.hash("pending123", 12),
    displayName: "待审核商家",
    kind: "MERCHANT_STAFF",
    source: "SEED"
  }
});

const pendingMerchant = await prisma.merchant.create({
  data: {
    name: "待审核测试店铺",
    type: "ENTERPRISE",
    status: "PENDING",
    contactName: "李四",
    contactPhone: "13900139003",
    contactEmail: "pending@test.com"
  }
});

await prisma.merchantStaff.create({
  data: {
    merchantId: pendingMerchant.id,
    userId: (await prisma.user.findUnique({ where: { email: "pending@test.com" } }))!.id,
    isOwner: true
  }
});
```
