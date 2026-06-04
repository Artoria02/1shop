import { prisma } from "@/db";
import { CategoryStatus, type Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";

export async function create(data: {
  name: string;
  logo?: string;
  description?: string;
}) {
  return prisma.brand.create({ data });
}

export async function findMany(params?: { status?: CategoryStatus; search?: string }) {
  const where: Prisma.BrandWhereInput = {};
  if (params?.status) where.status = params.status;
  if (params?.search) {
    where.name = { contains: params.search, mode: "insensitive" };
  }

  return prisma.brand.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });
}

export async function findById(id: string) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw new NotFoundError("Brand");
  return brand;
}

export async function update(id: string, data: {
  name?: string;
  logo?: string;
  description?: string;
}) {
  await findById(id);
  return prisma.brand.update({ where: { id }, data });
}

export async function toggleStatus(id: string) {
  const brand = await findById(id);
  const newStatus = brand.status === CategoryStatus.ACTIVE ? CategoryStatus.DISABLED : CategoryStatus.ACTIVE;
  return prisma.brand.update({ where: { id }, data: { status: newStatus } });
}
