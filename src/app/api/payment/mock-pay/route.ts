import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { handleCallback } from "@/server/services/payment.service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("paymentId");

  if (!paymentId) {
    return NextResponse.json(
      { error: "Missing paymentId" },
      { status: 400 }
    );
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    if (payment.status === "PAID") {
      return NextResponse.json({ success: true, message: "Already paid" });
    }

    // Trigger callback
    await handleCallback(
      payment.idempotencyKey,
      `mock-txn-${Date.now()}`,
      { mockPayment: true, paymentId }
    );

    return NextResponse.redirect(
      new URL(`/orders`, request.url)
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mock payment failed" },
      { status: 500 }
    );
  }
}
