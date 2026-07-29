import { prisma } from "@/db";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { generateOrderNo, generateSubOrderNo } from "@/lib/order-no";
import { assertTransition } from "@/lib/order-state-machine";
import { getCart } from "./cart.service";
import { removeSelectedItems } from "./cart.service";
import type {
  Prisma,
  OrderStatus,
  PaymentMethod,
} from "@prisma/client";

export interface CreateOrderInput {
  userId: string;
  skuIds: string[];
  addressId: string;
  paymentMethod: PaymentMethod;
  direct?: boolean;
}

export interface OrderListParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  search?: string;
}

export async function createOrder(input: CreateOrderInput) {
  const { userId, skuIds, addressId, direct } = input;

  // 1. Get selected items — from cart or direct
  let selectedItems: { skuId: string; productId: string; quantity: number }[];

  if (direct) {
    // 直接购买模式：不查购物车，直接根据 skuIds 生成订单项
    selectedItems = skuIds.map((skuId) => ({ skuId, productId: "", quantity: 1 }));
  } else {
    const cartItems = await getCart(userId);
    selectedItems = cartItems
      .filter((item) => skuIds.includes(item.skuId) && item.selected)
      .map((item) => ({ skuId: item.skuId, productId: item.productId, quantity: item.quantity }));
  }

  if (selectedItems.length === 0) {
    throw new ValidationError("No selected items in cart");
  }

  // 2. Get address snapshot
  const address = await prisma.shippingAddress.findUnique({
    where: { id: addressId },
  });
  if (!address || address.userId !== userId) {
    throw new NotFoundError("Address");
  }

  const addressSnapshot = {
    receiverName: address.receiverName,
    receiverPhone: address.receiverPhone,
    province: address.province,
    city: address.city,
    district: address.district,
    detail: address.detail,
  };

  // 3. Get SKUs with product info
  const skuRecords = await prisma.sku.findMany({
    where: { id: { in: selectedItems.map((i) => i.skuId) } },
    include: {
      product: {
        include: { merchant: true },
      },
    },
  });

  const skuMap = new Map(skuRecords.map((s) => [s.id, s]));

  // Validate all SKUs exist and products are on sale
  for (const item of selectedItems) {
    const sku = skuMap.get(item.skuId);
    if (!sku) throw new ValidationError(`SKU ${item.skuId} not found`);
    if (
      sku.product.status !== "APPROVED" ||
      sku.product.saleStatus !== "ON_SALE" ||
      sku.status !== "ON_SALE"
    ) {
      throw new ValidationError(`SKU ${item.skuId} is not available`);
    }
  }

  // 4. Group by merchant
  const merchantGroups = new Map<
    string,
    { merchantId: string; merchantName: string; items: typeof selectedItems }
  >();

  for (const item of selectedItems) {
    const sku = skuMap.get(item.skuId)!;
    const mid = sku.product.merchantId;
    if (!merchantGroups.has(mid)) {
      merchantGroups.set(mid, {
        merchantId: mid,
        merchantName: sku.product.merchant.name,
        items: [],
      });
    }
    merchantGroups.get(mid)!.items.push(item);
  }

  // 5. Create order in transaction
  const orderNo = generateOrderNo();
  const expireAt = new Date(
    Date.now() + parseInt(process.env.PAYMENT_TIMEOUT_MINUTES ?? "30") * 60 * 1000
  );

  const order = await prisma.$transaction(async (tx) => {
    // Lock and deduct inventory
    for (const item of selectedItems) {
      const sku = skuMap.get(item.skuId)!;
      if (sku.stock < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for ${sku.skuCode}: need ${item.quantity}, have ${sku.stock}`
        );
      }
      await tx.sku.update({
        where: { id: sku.id },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Create master order
    const masterOrder = await tx.order.create({
      data: {
        buyerId: userId,
        orderNo,
        totalAmount: 0, // will update
        status: "PENDING_PAYMENT",
        addressSnapshot: addressSnapshot as Prisma.InputJsonValue,
        expireAt,
      },
    });

    // Create sub orders
    let totalAmount = 0;
    let subIndex = 0;
    for (const [, group] of merchantGroups) {
      let subTotal = 0;
      const subOrderNo = generateSubOrderNo(orderNo, subIndex);

      const subOrder = await tx.subOrder.create({
        data: {
          orderId: masterOrder.id,
          merchantId: group.merchantId,
          subOrderNo,
          merchantName: group.merchantName,
          totalAmount: 0, // will update after items
          status: "PENDING_PAYMENT",
        },
      });

      for (const item of group.items) {
        const sku = skuMap.get(item.skuId)!;
        const amount = sku.price * item.quantity;
        subTotal += amount;

        await tx.orderItem.create({
          data: {
            subOrderId: subOrder.id,
            productId: sku.productId,
            skuId: sku.id,
            productName: sku.product.name,
            productImage: sku.product.mainImage,
            skuSpecs: sku.specs as Prisma.InputJsonValue,
            skuCode: sku.skuCode,
            price: sku.price,
            quantity: item.quantity,
            amount,
          },
        });
      }

      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: { totalAmount: subTotal },
      });

      totalAmount += subTotal;
      subIndex++;
    }

    // Update master order total
    await tx.order.update({
      where: { id: masterOrder.id },
      data: { totalAmount },
    });

    return tx.order.findUnique({
      where: { id: masterOrder.id },
      include: {
        subOrders: {
          include: {
            items: true,
          },
        },
      },
    });
  });

  // 6. Remove purchased items from cart
  await removeSelectedItems(userId, skuIds);

  // 7. Audit log
  await writeAuditLog({
    actorType: "USER",
    actorId: userId,
    action: "ORDER_CREATED",
    resource: "Order",
    resourceId: order!.id,
    metadata: { orderNo, skuIds, totalAmount: order!.totalAmount },
  });

  return order!;
}

export async function findOrderById(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      subOrders: {
        include: {
          items: true,
          shipment: true,
        },
      },
      payment: true,
    },
  });
  if (!order) throw new NotFoundError("Order");
  return order;
}

export async function findOrdersByBuyer(
  userId: string,
  params: OrderListParams = {}
) {
  const { page = 1, pageSize = 10, status } = params;
  const where: Prisma.OrderWhereInput = {
    buyerId: userId,
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        subOrders: { include: { items: true } },
        payment: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function findSubOrdersByMerchant(
  merchantId: string,
  params: OrderListParams = {}
) {
  const { page = 1, pageSize = 10, status, search } = params;
  const where: Prisma.SubOrderWhereInput = {
    merchantId,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { subOrderNo: { contains: search, mode: "insensitive" } },
            { merchantName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.subOrder.findMany({
      where,
      include: {
        items: true,
        shipment: true,
        order: { select: { orderNo: true, addressSnapshot: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subOrder.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function findAllOrders(params: OrderListParams = {}) {
  const { page = 1, pageSize = 20, status, search } = params;
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { orderNo: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        buyer: { select: { phone: true, email: true } },
        subOrders: {
          include: { items: true, shipment: true },
        },
        payment: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function cancelOrder(
  orderId: string,
  userId: string,
  reason?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { subOrders: { include: { items: true } } },
  });

  if (!order) throw new NotFoundError("Order");
  if (order.buyerId !== userId) throw new ForbiddenError("Not your order");
  assertTransition(order.status, "CANCELLED");

  await prisma.$transaction(async (tx) => {
    // Release inventory
    for (const sub of order.subOrders) {
      for (const item of sub.items) {
        await tx.sku.update({
          where: { id: item.skuId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    // Update order and sub orders
    await tx.subOrder.updateMany({
      where: { orderId },
      data: { status: "CANCELLED" },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason ?? "Buyer cancelled",
      },
    });
  });

  await writeAuditLog({
    actorType: "USER",
    actorId: userId,
    action: "ORDER_CANCELLED",
    resource: "Order",
    resourceId: orderId,
    metadata: { orderNo: order.orderNo, reason },
  });

  return findOrderById(orderId);
}

export async function confirmReceipt(subOrderId: string, userId: string) {
  const subOrder = await prisma.subOrder.findUnique({
    where: { id: subOrderId },
    include: { order: true },
  });

  if (!subOrder) throw new NotFoundError("SubOrder");
  if (subOrder.order.buyerId !== userId)
    throw new ForbiddenError("Not your order");
  assertTransition(subOrder.status, "RECEIVED");

  const updated = await prisma.subOrder.update({
    where: { id: subOrderId },
    data: {
      status: "RECEIVED",
      receivedAt: new Date(),
    },
  });

  // Check if all sub orders received -> update master order
  const allSubOrders = await prisma.subOrder.findMany({
    where: { orderId: subOrder.orderId },
  });
  const allReceived = allSubOrders.every((s) => s.status === "RECEIVED");
  if (allReceived) {
    await prisma.order.update({
      where: { id: subOrder.orderId },
      data: { status: "RECEIVED" },
    });
  }

  await writeAuditLog({
    actorType: "USER",
    actorId: userId,
    action: "ORDER_RECEIVED",
    resource: "SubOrder",
    resourceId: subOrderId,
    metadata: { subOrderNo: subOrder.subOrderNo },
  });

  return updated;
}

export async function completeOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) throw new NotFoundError("Order");
  assertTransition(order.status, "COMPLETED");

  await prisma.$transaction(async (tx) => {
    await tx.subOrder.updateMany({
      where: { orderId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  await writeAuditLog({
    actorType: "SYSTEM",
    action: "ORDER_COMPLETED",
    resource: "Order",
    resourceId: orderId,
    metadata: { orderNo: order.orderNo },
  });
}

export async function timeoutCancel(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { subOrders: { include: { items: true } } },
  });

  if (!order) throw new NotFoundError("Order");
  if (order.status !== "PENDING_PAYMENT") return; // already handled

  // Check if actually expired
  if (order.expireAt && order.expireAt > new Date()) return; // not yet expired

  await prisma.$transaction(async (tx) => {
    for (const sub of order.subOrders) {
      for (const item of sub.items) {
        await tx.sku.update({
          where: { id: item.skuId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await tx.subOrder.updateMany({
      where: { orderId },
      data: { status: "CANCELLED" },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: "Payment timeout",
      },
    });
  });

  await writeAuditLog({
    actorType: "SYSTEM",
    action: "ORDER_TIMEOUT_CANCELLED",
    resource: "Order",
    resourceId: orderId,
    metadata: { orderNo: order.orderNo },
  });
}
