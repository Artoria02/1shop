import { prisma, redis } from "@/db";
import { setSessionCookie } from "@/lib/auth";
import type { SessionPayload } from "@/lib/types";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { sendSms } from "@/lib/sms";

const SALT_ROUNDS = 12;

// ── online status (Redis) ──

const ONLINE_TTL = 3600; // 1 hour

function onlineKey(merchantId: string, subjectId: string) {
  return `online:${merchantId}:${subjectId}`;
}

export async function setOnline(merchantId: string, subjectId: string, sessionToken: string) {
  await redis.setex(onlineKey(merchantId, subjectId), ONLINE_TTL, sessionToken);
}

export async function clearOnline(merchantId: string, subjectId: string) {
  await redis.del(onlineKey(merchantId, subjectId));
}

export async function isOnline(merchantId: string, subjectId: string): Promise<string | null> {
  return redis.get(onlineKey(merchantId, subjectId));
}

export interface AuthResult {
  sessionPayload: Omit<SessionPayload, "iat" | "exp">;
}

function generateSessionToken(): string {
  return crypto.randomUUID();
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
  const user = await findUserByAccount(account);
  if (!user) throw new UnauthorizedError("账号或密码错误");

  await verifyCredentials(user, password);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { getUserRoles } = await import("@/lib/rbac");
  const roles = await getUserRoles(user.id);

  const sessionToken = generateSessionToken();

  return {
    sessionPayload: { sub: user.id, end: "BUYER", roles, sessionToken }
  };
}

// ── Merchant login (主账号 + 子账号) ──

export async function loginAsMerchant(account: string, password: string): Promise<AuthResult> {
  // 1. 尝试主账号登录：查 User 表
  const user = await findUserByAccount(account);
  if (user) {
    await verifyCredentials(user, password);
    if (!user.merchantId) throw new UnauthorizedError("账号不存在");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { getUserRoles } = await import("@/lib/rbac");
    const roles = await getUserRoles(user.id);

    const sessionToken = generateSessionToken();
    await setOnline(user.merchantId, user.id, sessionToken);

    return {
      sessionPayload: { sub: user.id, end: "MERCHANT", roles, merchantId: user.merchantId, sessionToken }
    };
  }

  // 2. 尝试子账号登录：按 phone 或 accountName 查 MerchantStaff 表
  const staff = await prisma.merchantStaff.findFirst({
    where: { OR: [{ phone: account }, { accountName: account }] }
  });
  if (!staff) throw new UnauthorizedError("账号或密码错误");
  if (staff.status !== "ACTIVE") throw new UnauthorizedError("账号已被禁用");

  const isValid = await bcrypt.compare(password, staff.passwordHash);
  if (!isValid) throw new UnauthorizedError("账号或密码错误");

  const sessionToken = generateSessionToken();
  await setOnline(staff.merchantId, staff.id, sessionToken);

  return {
    sessionPayload: { sub: staff.id, end: "MERCHANT", roles: ["MERCHANT"], merchantId: staff.merchantId, sessionToken }
  };
}

// ── Merchant owner phone + SMS login (主账号快捷登录) ──

export async function loginAsMerchantByPhone(phone: string, code: string): Promise<AuthResult> {
  if (!PHONE_REGEX.test(phone)) throw new AppError("请输入正确的手机号", 400, "INVALID_PHONE");
  if (!code || code.length !== 6) throw new AppError("请输入6位验证码", 400, "INVALID_CODE");

  const attemptStr = await redis.get(attemptKey(phone));
  const attempts = parseInt(attemptStr ?? "0", 10);
  if (attempts >= SMS_ATTEMPT_MAX) {
    await redis.del(smsKey(phone), attemptKey(phone));
    throw new AppError("验证码已失效，请重新获取", 400, "CODE_EXPIRED");
  }

  const storedCode = await redis.get(smsKey(phone));
  await redis.incr(attemptKey(phone));

  if (!storedCode || storedCode !== code) throw new AppError("验证码错误", 400, "INVALID_CODE");

  await redis.del(smsKey(phone), attemptKey(phone), cooldownKey(phone), dailyKey(phone));

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.merchantId) {
    throw new UnauthorizedError("账号不存在，员工请使用账号密码登录");
  }
  if (user.status !== "ACTIVE") throw new UnauthorizedError("账号已被禁用");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { getUserRoles } = await import("@/lib/rbac");
  const roles = await getUserRoles(user.id);

  const sessionToken = generateSessionToken();
  await setOnline(user.merchantId, user.id, sessionToken);

  return {
    sessionPayload: { sub: user.id, end: "MERCHANT", roles, merchantId: user.merchantId, sessionToken }
  };
}

// ── Platform admin login (独立表) ──

export async function loginAsAdmin(email: string, password: string): Promise<AuthResult> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.passwordHash) throw new UnauthorizedError("账号或密码错误");
  if (admin.status !== "ACTIVE") throw new UnauthorizedError("账号已被禁用");

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) throw new UnauthorizedError("账号或密码错误");

  const sessionToken = generateSessionToken();

  return {
    sessionPayload: { sub: admin.id, end: "PLATFORM_ADMIN", roles: ["PLATFORM_ADMIN"], sessionToken }
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

  const existingUser = await prisma.user.findUnique({ where: { phone } });

  if (existingUser) {
    if (existingUser.merchantId) {
      throw new AppError("该手机号已注册为商家，可直接登录", 409, "PHONE_EXISTS");
    }
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
  const displayName = emailTrimmed?.split("@")[0] ?? `用户${phone.slice(-4)}`;

  const user = await prisma.user.create({
    data: {
      phone,
      email: emailTrimmed,
      passwordHash,
      displayName,
      source: "WEB"
    }
  });

  const buyerRole = await prisma.role.findUnique({ where: { code: "BUYER" } });
  if (buyerRole) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: buyerRole.id } });
  }

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

  // 查找或创建用户，确保有 BUYER 身份
  let user = await prisma.user.findUnique({ where: { phone } });
  const buyerRole = await prisma.role.findUnique({ where: { code: "BUYER" } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        displayName: `用户${phone.slice(-4)}`,
        source: "WEB"
      }
    });
    if (buyerRole) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: buyerRole.id } });
    }
  } else if (buyerRole) {
    // 已有 User 但无 BUYER 角色（如员工被添加后首次买家登录），自动添加
    const hasBuyerRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: buyerRole.id } }
    });
    if (!hasBuyerRole) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: buyerRole.id } });
    }
  }

  if (user.status !== "ACTIVE") {
    throw new UnauthorizedError("账号已被禁用");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const sessionToken = generateSessionToken();
  return {
    sessionPayload: { sub: user.id, end: "BUYER", roles: [], sessionToken }
  };
}

// ── Profile ──

async function verifyPasswordOrThrow(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true }
  });
  const hash = user?.passwordHash;
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
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

