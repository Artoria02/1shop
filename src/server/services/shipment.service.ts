import { prisma } from "@/db";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { assertTransition } from "@/lib/order-state-machine";

export async function createShipment(
  subOrderId: string,
  merchantId: string,
  carrier: string,
  trackingNo: string
) {
  const subOrder = await prisma.subOrder.findUnique({
    where: { id: subOrderId },
    include: { order: true },
  });

  if (!subOrder) throw new NotFoundError("SubOrder");
  if (subOrder.merchantId !== merchantId) {
    throw new ForbiddenError("Not your sub order");
  }
  assertTransition(subOrder.status, "SHIPPED");

  // Check if shipment already exists
  const existing = await prisma.shipment.findUnique({
    where: { subOrderId },
  });
  if (existing) throw new Error("Shipment already created");

  const shipment = await prisma.shipment.create({
    data: {
      subOrderId,
      carrier,
      trackingNo,
      status: "SHIPPED",
      shippedAt: new Date(),
    },
  });

  // Update sub order status
  await prisma.subOrder.update({
    where: { id: subOrderId },
    data: { status: "SHIPPED", shippedAt: new Date() },
  });

  // Check if all sub orders shipped -> update master order
  const allSubOrders = await prisma.subOrder.findMany({
    where: { orderId: subOrder.orderId },
  });
  const allShipped = allSubOrders.every(
    (s) => s.status === "SHIPPED" || s.status === "RECEIVED" || s.status === "COMPLETED"
  );
  if (allShipped) {
    await prisma.order.update({
      where: { id: subOrder.orderId },
      data: { status: "SHIPPED" },
    });
  }

  await writeAuditLog({
    actorType: "USER",
    actorId: merchantId,
    action: "SHIPMENT_CREATED",
    resource: "Shipment",
    resourceId: shipment.id,
    metadata: {
      subOrderNo: subOrder.subOrderNo,
      carrier,
      trackingNo,
    },
  });

  return shipment;
}

export async function findBySubOrderId(subOrderId: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { subOrderId },
  });
  if (!shipment) throw new NotFoundError("Shipment");
  return shipment;
}
