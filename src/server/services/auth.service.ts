import { prisma, redis } from "@/db";
import { setSessionCookie } from "@/lib/auth";
import type { SessionPayload } from "@/lib/types";
import bcrypt from "bcryptjs";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { sendSms } from "@/lib/sms";

const SALT_ROUNDS = 12;

export interface AuthResult {
  sessionPayload: Omit<SessionPayload, "iat" | "exp">;
}

// ── shared auth helpers ──

async function findUserByAccount(account: string) {
  const isEmail = account.includes("@");
  return isEmail
    ? prisma.user.findUnique({ where: { email: account } })
    : prisma.user.findUnique({ where: { phone: account } });
}

async function verifyCredentials(user: { id: string; passwordHash: string | null; status: string }, password: string): Promise<void> {
  if (!user.passwordHash) throw new UnauthorizedError("账号或密码错误");
  if (user.status !== "ACTIVE") throw new UnauthorizedError("账号已被禁用");
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new UnauthorizedError("账号或密码错误");
}

// ── Buyer login ──

export async function loginWithPassword(account: string, password: string): Promise<AuthResult> {
  const hasEmail = account.includes("@");
  const user = hasEmail
    ? await prisma.user.findUnique({
        where: { email: account },
        include: { buyerProfile: { select: { passwordHash: true } } }
      })
    : await prisma.user.findUnique({
        where: { phone: account },
        include: { buyerProfile: { select: { passwordHash: true } } }
      });

  if (!user) throw new UnauthorizedError("账号或密码错误");
  if (user.status !== "ACTIVE") throw new UnauthorizedError("账号已被禁用");

  // Buyer login uses BuyerProfile.passwordHash exclusively
  if (!user.buyerProfile?.passwordHash) throw new UnauthorizedError("账号或密码错误");

  const isValid = await bcrypt.compare(password, user.buyerProfile.passwordHash);
  if (!isValid) throw new UnauthorizedError("账号或密码错误");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { getUserRoles } = await import("@/lib/rbac");
  const roles = await getUserRoles(user.id);

  return {
    sessionPayload: { sub: user.id, end: "BUYER", roles }
  };
}

// ── Merchant staff login ──

export async function loginAsMerchant(account: string, password: string): Promise<AuthResult> {
  const user = await findUserByAccount(account);
  if (!user) throw new UnauthorizedError("账号或密码错误");

  await verifyCredentials(user, password);

  const staff = await prisma.merchantStaff.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { merchant: true }
  });
  if (!staff) throw new UnauthorizedError("该账号无商家员工身份");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { getUserRoles } = await import("@/lib/rbac");
  const roles = await getUserRoles(user.id);

  return {
    sessionPayload: { sub: user.id, end: "MERCHANT_STAFF", roles, merchantId: staff.merchantId }
  };
}

// ── Platform admin login (独立表) ──

export async function loginAsAdmin(email: string, password: string): Promise<AuthResult> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.passwordHash) throw new UnauthorizedError("账号或密码错误");
  if (admin.status !== "ACTIVE") throw new UnauthorizedError("账号已被禁用");

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) throw new UnauthorizedError("账号或密码错误");

  return {
    sessionPayload: { sub: admin.id, end: "PLATFORM_ADMIN", roles: ["PLATFORM_ADMIN"] }
  };
}

export async function registerAdmin(email: string, password: string, displayName: string) {
  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) throw new AppError("Email already registered", 409, "EMAIL_EXISTS");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.platformAdmin.create({
    data: { email, passwordHash, displayName }
  });
}

export async function createSession(authResult: AuthResult): Promise<void> {
  await setSessionCookie(authResult.sessionPayload);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── SMS helpers ──

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const SMS_CODE_TTL = 300;
const SMS_COOLDOWN_TTL = 60;
const SMS_DAILY_LIMIT = 5;
const SMS_ATTEMPT_MAX = 3;

function smsKey(phone: string) { return `sms:login:${phone}`; }
function cooldownKey(phone: string) { return `sms:cooldown:${phone}`; }
function dailyKey(phone: string) { return `sms:daily:${phone}`; }
function attemptKey(phone: string) { return `sms:attempt:${phone}`; }

export async function registerUser(params: {
  phone: string;
  code: string;
  password: string;
  email?: string;
}): Promise<AuthResult> {
  const { phone, code, password, email } = params;

  if (!PHONE_REGEX.test(phone)) {
    throw new AppError("请输入正确的手机号", 400, "INVALID_PHONE");
  }
  if (!code || code.length !== 6) {
    throw new AppError("请输入6位验证码", 400, "INVALID_CODE");
  }
  if (password.length < 6) {
    throw new AppError("密码至少需要6位", 400, "WEAK_PASSWORD");
  }

  const existingUser = await prisma.user.findUnique({
    where: { phone },
    include: { buyerProfile: true }
  });

  // 已有买家身份 → 拒绝
  if (existingUser?.buyerProfile) {
    throw new AppError("该手机号已注册", 409, "PHONE_EXISTS");
  }

  const emailTrimmed = email?.trim() || null;
  if (emailTrimmed) {
    const emailExists = await prisma.user.findUnique({ where: { email: emailTrimmed } });
    if (emailExists) {
      throw new AppError("该邮箱已注册", 409, "EMAIL_EXISTS");
    }
  }

  const attemptStr = await redis.get(attemptKey(phone));
  const attempts = parseInt(attemptStr ?? "0", 10);

  if (attempts >= SMS_ATTEMPT_MAX) {
    await redis.del(smsKey(phone), attemptKey(phone));
    throw new AppError("验证码已失效，请重新获取", 400, "CODE_EXPIRED");
  }

  const storedCode = await redis.get(smsKey(phone));
  await redis.incr(attemptKey(phone));

  if (!storedCode || storedCode !== code) {
    throw new AppError("验证码错误", 400, "INVALID_CODE");
  }

  await redis.del(smsKey(phone), attemptKey(phone), cooldownKey(phone), dailyKey(phone));

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  if (existingUser) {
    // 员工转买家：密码存 BuyerProfile，不覆盖 User.passwordHash（保留员工登录密码）
    await prisma.buyerProfile.create({
      data: { userId: existingUser.id, passwordHash, displayName: emailTrimmed?.split("@")[0] ?? `用户${phone.slice(-4)}` }
    });

    return {
      sessionPayload: { sub: existingUser.id, end: "BUYER", roles: [] }
    };
  }

  // 全新用户
  const user = await prisma.user.create({
    data: {
      phone,
      email: emailTrimmed,
      displayName: emailTrimmed?.split("@")[0] ?? `用户${phone.slice(-4)}`,
      source: "WEB"
    }
  });

  await prisma.buyerProfile.create({ data: { userId: user.id, passwordHash, displayName: user.displayName } });

  return {
    sessionPayload: { sub: user.id, end: "BUYER", roles: [] }
  };
}

export async function sendLoginSmsCode(phone: string): Promise<void> {
  if (!PHONE_REGEX.test(phone)) {
    throw new AppError("请输入正确的手机号", 400, "INVALID_PHONE");
  }

  const cooldown = await redis.get(cooldownKey(phone));
  if (cooldown) {
    throw new AppError("验证码已发送，请稍后再试", 429, "SMS_COOLDOWN");
  }

  const existingCode = await redis.get(smsKey(phone));

  // 已有有效验证码时重新发送，不累计每日次数
  if (!existingCode) {
    const dailyCount = parseInt((await redis.get(dailyKey(phone))) ?? "0", 10);
    if (dailyCount >= SMS_DAILY_LIMIT) {
      throw new AppError("今日验证码发送次数已达上限", 429, "SMS_DAILY_LIMIT");
    }

    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const dailyRemaining = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
    await redis.setex(dailyKey(phone), dailyRemaining, String(dailyCount + 1));
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));

  // 存储验证码，同时初始化尝试次数
  await redis.setex(smsKey(phone), SMS_CODE_TTL, code);
  await redis.setex(attemptKey(phone), SMS_CODE_TTL, "0");
  await redis.setex(cooldownKey(phone), SMS_COOLDOWN_TTL, "1");

  await sendSms(phone, `【1Shop】您的验证码是 ${code}，${SMS_CODE_TTL / 60}分钟内有效。`);
}

export async function loginByPhone(phone: string, code: string): Promise<AuthResult> {
  if (!PHONE_REGEX.test(phone)) {
    throw new AppError("请输入正确的手机号", 400, "INVALID_PHONE");
  }
  if (!code || code.length !== 6) {
    throw new AppError("请输入6位验证码", 400, "INVALID_CODE");
  }

  const attemptStr = await redis.get(attemptKey(phone));
  const attempts = parseInt(attemptStr ?? "0", 10);

  if (attempts >= SMS_ATTEMPT_MAX) {
    await redis.del(smsKey(phone), attemptKey(phone));
    throw new AppError("验证码已失效，请重新获取", 400, "CODE_EXPIRED");
  }

  const storedCode = await redis.get(smsKey(phone));

  // 每次尝试都 +1
  await redis.incr(attemptKey(phone));

  if (!storedCode || storedCode !== code) {
    throw new AppError("验证码错误", 400, "INVALID_CODE");
  }

  // 验证成功，清除相关 Redis 键（含每日计数，登录成功重置限额）
  await redis.del(smsKey(phone), attemptKey(phone), cooldownKey(phone), dailyKey(phone));

  // 查找或创建用户
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        displayName: `用户${phone.slice(-4)}`,
        source: "WEB"
      }
    });
    await prisma.buyerProfile.create({ data: { userId: user.id, displayName: `用户${phone.slice(-4)}` } });
  } else {
    // 已有 User 但无 BuyerProfile（如员工被添加后首次买家登录），自动创建
    const existing = await prisma.buyerProfile.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.buyerProfile.create({
        data: { userId: user.id, displayName: `用户${phone.slice(-4)}` }
      });
    }
  }

  if (user.status !== "ACTIVE") {
    throw new UnauthorizedError("账号已被禁用");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    sessionPayload: { sub: user.id, end: "BUYER", roles: [] }
  };
}

// ── Profile ──

async function verifyPasswordOrThrow(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      buyerProfile: { select: { passwordHash: true } }
    }
  });
  // Check buyer password first, fallback to user password
  const hash = user?.buyerProfile?.passwordHash || user?.passwordHash;
  if (!hash) throw new AppError("账号异常", 400, "NO_PASSWORD");
  const valid = await bcrypt.compare(password, hash);
  if (!valid) throw new AppError("密码错误", 400, "WRONG_PASSWORD");
}

export async function updateProfile(userId: string, data: { displayName?: string; avatar?: string }): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (data.displayName !== undefined) {
    if (!data.displayName.trim()) throw new AppError("昵称不能为空", 400, "INVALID_NAME");
    updateData.displayName = data.displayName.trim();
  }

  if (data.avatar !== undefined) {
    updateData.avatar = data.avatar;
  }

  if (Object.keys(updateData).length === 0) return;

  await prisma.user.update({ where: { id: userId }, data: updateData });
}

export async function changeEmail(userId: string, newEmail: string, password: string): Promise<void> {
  const emailTrimmed = newEmail.trim();
  if (!emailTrimmed) throw new AppError("请输入新邮箱", 400, "INVALID_EMAIL");

  await verifyPasswordOrThrow(userId, password);

  const existing = await prisma.user.findFirst({
    where: { email: emailTrimmed, id: { not: userId } }
  });
  if (existing) throw new AppError("该邮箱已被使用", 409, "EMAIL_EXISTS");

  await prisma.user.update({ where: { id: userId }, data: { email: emailTrimmed } });
}

export async function changePhone(userId: string, newPhone: string, code: string, password: string): Promise<void> {
  if (!PHONE_REGEX.test(newPhone)) throw new AppError("请输入正确的手机号", 400, "INVALID_PHONE");
  if (!code || code.length !== 6) throw new AppError("请输入6位验证码", 400, "INVALID_CODE");

  await verifyPasswordOrThrow(userId, password);

  const existing = await prisma.user.findUnique({ where: { phone: newPhone } });
  if (existing) throw new AppError("该手机号已被使用", 409, "PHONE_EXISTS");

  // Verify SMS code for new phone
  const attemptStr = await redis.get(attemptKey(newPhone));
  const attempts = parseInt(attemptStr ?? "0", 10);
  if (attempts >= SMS_ATTEMPT_MAX) {
    await redis.del(smsKey(newPhone), attemptKey(newPhone));
    throw new AppError("验证码已失效，请重新获取", 400, "CODE_EXPIRED");
  }
  const storedCode = await redis.get(smsKey(newPhone));
  await redis.incr(attemptKey(newPhone));
  if (!storedCode || storedCode !== code) throw new AppError("验证码错误", 400, "INVALID_CODE");

  await redis.del(smsKey(newPhone), attemptKey(newPhone), cooldownKey(newPhone), dailyKey(newPhone));
  await prisma.user.update({ where: { id: userId }, data: { phone: newPhone } });
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 6) throw new AppError("新密码至少需要6位", 400, "WEAK_PASSWORD");

  if (oldPassword) {
    await verifyPasswordOrThrow(userId, oldPassword);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // 买家密码存 BuyerProfile，否则存 User
  const buyerProfile = await prisma.buyerProfile.findUnique({ where: { userId } });
  if (buyerProfile) {
    await prisma.buyerProfile.update({ where: { userId }, data: { passwordHash } });
  } else {
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}

