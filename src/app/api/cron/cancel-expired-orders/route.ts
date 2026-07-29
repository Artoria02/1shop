import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { timeoutCancel } from "@/server/services/order.service";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        expireAt: { lt: new Date() },
      },
      take: 100,
    });

    let cancelled = 0;
    for (const order of expiredOrders) {
      try {
        await timeoutCancel(order.id);
        cancelled++;
      } catch (e) {
        // Log and continue
        console.error(`Failed to cancel order ${order.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      total: expiredOrders.length,
      cancelled,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
