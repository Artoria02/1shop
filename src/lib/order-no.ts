import crypto from "crypto";

export function generateOrderNo(): string {
  const now = new Date();
  const y = now.getFullYear().toString();
  const M = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const s = now.getSeconds().toString().padStart(2, "0");
  const rand = crypto.randomInt(100000, 999999).toString();
  return `${y}${M}${d}${h}${m}${s}${rand}`;
}

export function generateSubOrderNo(
  orderNo: string,
  index: number
): string {
  return `${orderNo}-${(index + 1).toString().padStart(2, "0")}`;
}

export function generateIdempotencyKey(): string {
  return `idem-${crypto.randomUUID()}`;
}
