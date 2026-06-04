import { prisma } from "@/db";
import { CategoryStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";

export async function create(data: {
  name: string;
  parentId?: string;
  sortOrder?: number;
  icon?: string;
}) {
  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new NotFoundError("Parent category");
  }

  return prisma.category.create({
    data: {
      name: data.name,
      parentId: data.parentId,
      sortOrder: data.sortOrder ?? 0,
      icon: data.icon
    }
  });
}

export async function findTree() {
  const all = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }]
  });

  const map = new Map<string, typeof all[number] & { children: typeof all }>();
  const roots: typeof all = [];

  for (const cat of all) {
    const node = { ...cat, children: [] as typeof all };
    map.set(cat.id, node);
  }

  for (const cat of all) {
    const node = map.get(cat.id)!;
    if (cat.parentId) {
      const parent = map.get(cat.parentId);
      if (parent) {
        parent.children.push(node as unknown as typeof all[number]);
      }
    } else {
      roots.push(node as unknown as typeof all[number]);
    }
  }

  return roots;
}

export async function findActiveTree() {
  const all = await prisma.category.findMany({
    where: { status: CategoryStatus.ACTIVE },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }]
  });

  const map = new Map<string, typeof all[number] & { children: typeof all }>();
  const roots: typeof all = [];

  for (const cat of all) {
    const node = { ...cat, children: [] as typeof all };
    map.set(cat.id, node);
  }

  for (const cat of all) {
    const node = map.get(cat.id)!;
    if (cat.parentId) {
      const parent = map.get(cat.parentId);
      if (parent) {
        parent.children.push(node as unknown as typeof all[number]);
      }
    } else {
      roots.push(node as unknown as typeof all[number]);
    }
  }

  return roots;
}

export async function findById(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new NotFoundError("Category");
  return category;
}

export async function update(id: string, data: {
  name?: string;
  sortOrder?: number;
  icon?: string;
}) {
  await findById(id);
  return prisma.category.update({
    where: { id },
    data
  });
}

export async function toggleStatus(id: string) {
  const category = await findById(id);
  const newStatus = category.status === CategoryStatus.ACTIVE ? CategoryStatus.DISABLED : CategoryStatus.ACTIVE;
  return prisma.category.update({
    where: { id },
    data: { status: newStatus }
  });
}
