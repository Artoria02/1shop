import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/server/services/payment.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idempotencyKey, transactionId } = body;

    if (!idempotencyKey || !transactionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await handleCallback(
      idempotencyKey,
      transactionId,
      body
    );

    return NextResponse.json({ ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Callback processing failed" },
      { status: 500 }
    );
  }
}
