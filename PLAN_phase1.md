# Phase 1 — 项目基础搭建

> 对应 [PLAN.md](./PLAN.md) 第一阶段。

## 总体目标

搭建一个**可运行、可扩展、可接业务**的完整工程底座。第一阶段不实现任何业务功能，只完成基础设施、代码结构、认证、权限和基础布局，使后续阶段可以在此基础上直接叠加业务模块。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js App Router + TypeScript |
| 数据库 | PostgreSQL + Prisma |
| 缓存/队列 | Redis (ioredis) |
| 认证 | 手机号 + 短信验证码（首版可以 mock）/ 后台邮箱 + 密码 |
| 权限 | RBAC |
| 基础设施 | Docker Compose |
| 代码规范 | ESLint + Prettier |

## 实施步骤

### 1. 初始化项目

- 创建 Next.js App Router + TypeScript 项目
- 配置 ESLint、Prettier、tsconfig、路径别名
- 建立基础目录：`app/`、`server/`、`db/`、`components/`、`lib/`
- 配置 `package.json` 的 dev/build/check 脚本

### 2. 接入基础设施

- 编写 `docker-compose.yml`，包含 PostgreSQL 和 Redis
- 配置 `.env` / `.env.example`
- 接入 Prisma，配置 datasource
- 编写 Prisma Client 单例（`db/prisma.ts`）
- 编写 Redis 单例（`db/redis.ts`）
- 编写环境变量加载器（`lib/env.ts`）

### 3. 建立基础数据模型

- 设计并创建 Prisma Schema：
  - `User` — 手机号、邮箱、密码 hash、身份类型（BUYER / MERCHANT_STAFF / PLATFORM_ADMIN）、状态、注册来源
  - `Role` — 角色 code、名称、是否系统角色
  - `Permission` — 权限 code、名称
  - `UserRole` — 用户与角色关联
  - `RolePermission` — 角色与权限关联
  - `AuditLog` — 操作审计日志
- 为后续商家、商品、订单模型预留枚举和基础类型
- 编写 Seed 脚本：创建默认管理员账号和 RBAC 基线
- 跑通 migrate + seed

### 4. 接入认证与权限

- **买家端**：手机号 + 验证码登录结构预留，短信首版可 mock
- **后台**：邮箱 + 密码登录，密码使用 bcrypt/argon2 加密
- 基于 jose/jwt 或 next/headers cookie 实现 session 管理（`lib/session.ts`）
- 提供 API Routes：`/api/auth/login`、`/api/auth/logout`、`/api/auth/me`
- 实现 RBAC 权限判断函数（`lib/permissions.ts`）
  - `hasPermission(userId, code)` → boolean
  - `requirePermission(userId, code)` → throws
- 实现 API 守卫（`lib/auth-guard.ts`）：校验身份 + 角色 + 权限
- 买家端、商家后台、平台后台三端访问边界清晰隔离

### 5. 搭建三套路由和布局

- **买家端** `(buyer)/` — 根路径 `/`
  - 基础导航（顶部栏）
  - 首页占位
  - 登录 / 注册页面
  - 未登录重定向守卫
- **商家后台** `(merchant)/` — `/merchant`
  - 侧边栏导航 + 顶部栏
  - 首页统计占位
  - 登录页面
  - 权限守卫：只允许 MERCHANT_STAFF
- **平台后台** `(admin)/` — `/admin`
  - 侧边栏导航 + 顶部栏
  - 首页统计占位
  - 登录页面
  - 权限守卫：只允许 PLATFORM_ADMIN
  - 预留功能菜单占位：商家审核、商品审核、订单、佣金、结算、报表

### 6. 统一服务层规范

- `server/services/` — 业务逻辑封装
- `server/validations/` — 参数校验（Zod）
- API Routes / Server Actions 只做入参校验、调用 service、返回结果
- 第一个示例 service：`server/services/user.service.ts`
  - `findById`、`findByPhone`、`createUser`、`assignRole`

### 7. 错误处理与请求日志

- 统一错误类型（`lib/errors.ts`）：AppError、AuthError、PermissionError、NotFoundError、ValidationError
- 统一 API 响应格式（`lib/api-response.ts`）：`{ success, data, error }`
- 全局错误边界（`app/error.tsx`）
- 请求日志中间件（`lib/request-logger.ts`）：方法、路径、状态码、耗时
- 审计日志服务（`server/services/audit.service.ts`）：封装 AuditLog 写入

### 8. 验证基础可用

- 启动 docker compose，数据库和 Redis 可用
- 跑通 migrate + seed
- 本地开发服务器可启动，无报错
- 买家端、商家后台、平台后台均可访问，权限守卫正常
- 跨端访问被正确拦截（非管理员访问 `/admin` 返回 403）
- lint + typecheck 通过
- 核心函数有单元测试覆盖

## 验收标准

1. `npm run infra:up && npm run db:migrate && npm run db:seed` 全部通过
2. `npm run dev` 启动后浏览器可访问
3. 管理员可用 `admin@1shop.local` 登录平台后台
4. 三端页面均有独立导航和鉴权守卫
5. 权限放错端时返回 403 或重定向
6. `npm run lint` 和 `npm run typecheck` 通过
7. 核心函数有单元测试覆盖