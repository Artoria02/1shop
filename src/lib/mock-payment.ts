import { PaymentMethod } from "@prisma/client";

export interface CreatePaymentParams {
  orderId: string;
  orderNo: string;
  amount: number;
  method: PaymentMethod;
}

export interface CreatePaymentResult {
  paymentId: string;
  payUrl: string;
  qrCode?: string;
}

export async function createMockPayment(
  _params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  const { default: crypto } = await import("crypto");
  const paymentId = `mock-pay-${crypto.randomUUID()}`;

  return {
    paymentId,
    payUrl: `/api/payment/mock-pay?paymentId=${encodeURIComponent(paymentId)}`,
    qrCode: undefined,
  };
}

export function verifyCallbackSignature(_data: unknown): boolean {
  // Mock mode always returns true; real payment SDK would verify signature here
  return true;
}
