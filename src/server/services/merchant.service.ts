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

  if (data.userId) {
    const userId = data.userId;
    await prisma.$transaction(async (tx) => {
      await tx.merchantStaff.create({
        data: {
          merchantId: merchant.id,
          userId,
          isOwner: true
        }
      });

      const merchantRole = await tx.role.findUnique({ where: { code: "MERCHANT_STAFF" } });
      if (merchantRole) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId: merchantRole.id } },
          update: {},
          create: { userId, roleId: merchantRole.id }
        });
      }
    });
  } else if (data.password) {
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.contactEmail || null,
          phone: data.contactPhone || null,
          passwordHash,
          displayName: data.contactName,
          source: "WEB"
        }
      });

      await tx.merchantStaff.create({
        data: {
          merchantId: merchant.id,
          userId: user.id,
          isOwner: true
        }
      });

      const merchantRole = await tx.role.findUnique({ where: { code: "MERCHANT_STAFF" } });
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
    include: { staff: { include: { user: { select: { id: true, email: true, phone: true, displayName: true } } } } }
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

export async function addStaff(merchantId: string, userId: string, isOwner = false, displayName?: string) {
  const existing = await prisma.merchantStaff.findFirst({ where: { userId, merchantId } });
  if (existing) throw new ValidationError("该用户已经是本店铺的员工");

  return prisma.merchantStaff.create({
    data: { merchantId, userId, isOwner, displayName }
  });
}

export async function findStaffs(merchantId: string) {
  return prisma.merchantStaff.findMany({
    where: { merchantId },
    include: { user: { select: { id: true, email: true, phone: true, displayName: true } } }
  });
}

export async function removeStaff(merchantId: string, staffId: string) {
  const staff = await prisma.merchantStaff.findUnique({
    where: { id: staffId },
    include: { user: true }
  });

  if (!staff || staff.merchantId !== merchantId) {
    throw new ValidationError("员工不存在");
  }

  if (staff.isOwner) {
    throw new ValidationError("不能删除店主");
  }

  return prisma.merchantStaff.delete({ where: { id: staffId } });
}

export async function findByUserId(userId: string) {
  const staff = await prisma.merchantStaff.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { merchant: true }
  });
  return staff?.merchant ?? null;
}
