import { prisma } from "@/db";
import { redis } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { generateIdempotencyKey } from "@/lib/order-no";
import {
  createMockPayment,
  verifyCallbackSignature,
} from "@/lib/mock-payment";
import { assertTransition } from "@/lib/order-state-machine";
import type { PaymentMethod, Prisma } from "@prisma/client";

export async function createPayment(
  orderId: string,
  method: PaymentMethod
): Promise<{
  id: string;
  payUrl: string;
  orderNo: string;
  amount: number;
  status: string;
  method: string;
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) throw new NotFoundError("Order");
  if (order.status !== "PENDING_PAYMENT") {
    throw new ValidationError("Order cannot be paid in current status");
  }

  // Check if payment already exists
  const existing = await prisma.payment.findUnique({ where: { orderId } });
  if (existing) {
    return {
      ...existing,
      payUrl: `/api/payment/mock-pay?paymentId=${existing.id}`,
    };
  }

  const idempotencyKey = generateIdempotencyKey();

  const mockResult = await createMockPayment({
    orderId,
    orderNo: order.orderNo,
    amount: order.totalAmount,
    method,
  });

  const payment = await prisma.payment.create({
    data: {
      orderId,
      orderNo: order.orderNo,
      amount: order.totalAmount,
      method,
      status: "PENDING",
      idempotencyKey,
    },
  });

  await writeAuditLog({
    actorType: "SYSTEM",
    action: "PAYMENT_CREATED",
    resource: "Payment",
    resourceId: payment.id,
    metadata: { orderNo: order.orderNo, amount: order.totalAmount, method },
  });

  return { ...payment, payUrl: mockResult.payUrl };
}

const IDEMPOTENCY_TTL = 86400; // 24 hours

export async function handleCallback(
  idempotencyKey: string,
  transactionId: string,
  callbackData: unknown
) {
  // Verify signature (mock always true)
  if (!verifyCallbackSignature(callbackData)) {
    throw new ValidationError("Invalid payment callback signature");
  }

  // Idempotency check via Redis
  const idemKey = `idem:payment:${idempotencyKey}`;
  const cached = await redis.get(idemKey);
  if (cached === "processed") {
    return { success: true, duplicate: true };
  }

  // Find payment record
  const payment = await prisma.payment.findUnique({
    where: { idempotencyKey },
    include: { order: true },
  });
  if (!payment) throw new NotFoundError("Payment");

  if (payment.status === "PAID") {
    // Already paid, just mark idempotency
    await redis.setex(idemKey, IDEMPOTENCY_TTL, "processed");
    return { success: true, duplicate: true };
  }

  assertTransition(payment.order.status, "PAID");

  // Process payment
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        transactionId,
        paidAt: new Date(),
        callbackData: callbackData as Prisma.InputJsonValue,
      },
    });

    // Update order and all sub orders
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "PAID", paidAt: new Date() },
    });

    await tx.subOrder.updateMany({
      where: { orderId: payment.orderId },
      data: { status: "PAID", paidAt: new Date() },
    });
  });

  // Set idempotency key
  await redis.setex(idemKey, IDEMPOTENCY_TTL, "processed");

  await writeAuditLog({
    actorType: "SYSTEM",
    action: "PAYMENT_CALLBACK",
    resource: "Payment",
    resourceId: payment.id,
    metadata: {
      orderNo: payment.orderNo,
      transactionId,
      amount: payment.amount,
    },
  });

  return { success: true, duplicate: false };
}

export async function findByOrderId(orderId: string) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
  });
  if (!payment) throw new NotFoundError("Payment");
  return payment;
}
