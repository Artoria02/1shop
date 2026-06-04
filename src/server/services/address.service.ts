import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import type { CreateAddressInput, UpdateAddressInput } from "@/server/validations/address.validation";

export async function findAddressesByUser(userId: string) {
  return prisma.shippingAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
  });
}

export async function findAddressById(id: string, userId: string) {
  const addr = await prisma.shippingAddress.findUnique({ where: { id } });
  if (!addr || addr.userId !== userId) {
    throw new AppError("地址不存在", 404, "ADDRESS_NOT_FOUND");
  }
  return addr;
}

export async function createAddress(userId: string, input: CreateAddressInput) {
  if (input.isDefault) {
    await prisma.shippingAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });
  }

  return prisma.shippingAddress.create({
    data: { ...input, userId }
  });
}

export async function updateAddress(id: string, userId: string, input: UpdateAddressInput) {
  const addr = await findAddressById(id, userId);

  if (input.isDefault && !addr.isDefault) {
    await prisma.shippingAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });
  }

  return prisma.shippingAddress.update({
    where: { id },
    data: input
  });
}

export async function deleteAddress(id: string, userId: string) {
  await findAddressById(id, userId);
  return prisma.shippingAddress.delete({ where: { id } });
}

export async function setDefaultAddress(id: string, userId: string) {
  await findAddressById(id, userId);

  await prisma.shippingAddress.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false }
  });

  return prisma.shippingAddress.update({
    where: { id },
    data: { isDefault: true }
  });
}
