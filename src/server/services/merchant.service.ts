import { prisma } from "@/db";
import { MerchantStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function createApplication(data: {
  name: string;
  type: "ENTERPRISE" | "INDIVIDUAL";
  businessLicense?: string;
  legalPersonName?: string;
  legalPersonIdCard?: string;
  registerNo?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankName?: string;
  logo?: string;
  description?: string;
  address?: string;
  userId?: string;
  password?: string;
}) {
  const merchant = await prisma.merchant.create({
    data: {
      name: data.name,
      type: data.type,
      businessLicense: data.businessLicense,
      legalPersonName: data.legalPersonName,
      legalPersonIdCard: data.legalPersonIdCard,
      registerNo: data.registerNo,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      bankAccountName: data.bankAccountName,
      bankAccountNo: data.bankAccountNo,
      bankName: data.bankName,
      logo: data.logo,
      description: data.description,
      address: data.address
    }
  });

  // 优先按表单手机号查找已有 User，未登录或手机号不匹配则新建
  let effectiveUserId: string | undefined;

  if (data.userId) {
    const sessionUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { phone: true }
    });
    // 仅当 session 用户的手机号与申请表单一致时，才复用该 User
    if (sessionUser?.phone === data.contactPhone) {
      effectiveUserId = data.userId;
    }
  }

  if (effectiveUserId) {
    const userId = effectiveUserId;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { merchantId: merchant.id }
      });

      const merchantRole = await tx.role.findUnique({ where: { code: "MERCHANT" } });
      if (merchantRole) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId: merchantRole.id } },
          update: {},
          create: { userId, roleId: merchantRole.id }
        });
      }
    });
  } else {
    const passwordHash = data.password ? await bcrypt.hash(data.password, SALT_ROUNDS) : null;
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.contactEmail || null,
          phone: data.contactPhone || null,
          passwordHash,
          displayName: data.contactName,
          merchantId: merchant.id,
          source: "WEB"
        }
      });

      const merchantRole = await tx.role.findUnique({ where: { code: "MERCHANT" } });
      if (merchantRole) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: merchantRole.id }
        });
      }
    });
  }

  return merchant;
}

export async function findById(id: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id },
    include: { staff: true }
  });
  if (!merchant) throw new NotFoundError("Merchant");
  return merchant;
}

export async function findMany(params: {
  status?: MerchantStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, search, page = 1, pageSize = 20 } = params;

  const where: Prisma.MerchantWhereInput = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { registerNo: { contains: search, mode: "insensitive" } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.merchant.count({ where })
  ]);

  return { items, total, page, pageSize };
}

export async function review(id: string, data: { status: MerchantStatus; reviewedBy: string; reason?: string }) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) throw new NotFoundError("Merchant");

  const validTransitions: Record<MerchantStatus, MerchantStatus[]> = {
    [MerchantStatus.PENDING]: [MerchantStatus.APPROVED, MerchantStatus.REJECTED],
    [MerchantStatus.APPROVED]: [MerchantStatus.DISABLED],
    [MerchantStatus.REJECTED]: [MerchantStatus.APPROVED, MerchantStatus.DISABLED],
    [MerchantStatus.DISABLED]: [MerchantStatus.APPROVED]
  };

  if (!validTransitions[merchant.status].includes(data.status)) {
    throw new ValidationError(`无法将商家状态从 ${merchant.status} 变更为 ${data.status}`);
  }

  return prisma.merchant.update({
    where: { id },
    data: {
      status: data.status,
      reviewedBy: data.reviewedBy,
      reviewedAt: new Date(),
      rejectionReason: data.status === MerchantStatus.REJECTED ? data.reason : null
    }
  });
}

export async function addStaff(merchantId: string, accountName: string, nickname: string, phone: string, passwordHash: string) {
  const existing = await prisma.merchantStaff.findUnique({ where: { accountName } });
  if (existing) throw new ValidationError("该账号名已存在");

  return prisma.merchantStaff.create({
    data: { merchantId, accountName, nickname, phone, passwordHash }
  });
}

export async function findStaffs(merchantId: string) {
  return prisma.merchantStaff.findMany({
    where: { merchantId },
    select: { id: true, accountName: true, nickname: true, phone: true, displayName: true, status: true, createdAt: true }
  });
}

export async function removeStaff(merchantId: string, staffId: string) {
  const staff = await prisma.merchantStaff.findUnique({ where: { id: staffId } });

  if (!staff || staff.merchantId !== merchantId) {
    throw new ValidationError("员工不存在");
  }

  return prisma.merchantStaff.delete({ where: { id: staffId } });
}

export async function findByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { merchantId: true, ownedMerchant: true }
  });
  return user?.ownedMerchant ?? null;
}

export async function changeStaffPassword(staffId: string, newPasswordHash: string) {
  const staff = await prisma.merchantStaff.findUnique({ where: { id: staffId } });
  if (!staff) throw new NotFoundError("员工不存在");

  return prisma.merchantStaff.update({
    where: { id: staffId },
    data: { passwordHash: newPasswordHash }
  });
}

export async function updateMerchant(id: string, data: {
  name?: string;
  logo?: string;
  description?: string;
  address?: string;
  businessLicense?: string;
  legalPersonName?: string;
  legalPersonIdCard?: string;
  registerNo?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankName?: string;
}) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) throw new NotFoundError("Merchant");

  return prisma.merchant.update({
    where: { id },
    data
  });
}
