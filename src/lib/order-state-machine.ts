import { OrderStatus } from "@prisma/client";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "REFUNDING"],
  SHIPPED: ["RECEIVED", "REFUNDING"],
  RECEIVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDING: ["REFUNDED"],
  REFUNDED: [],
};

export function canTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertTransition(
  from: OrderStatus,
  to: OrderStatus
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid order status transition: ${from} -> ${to}`
    );
  }
}

export function getNextAllowed(from: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}
