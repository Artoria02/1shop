import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { completeOrder } from "@/server/services/order.service";

// 收货超过 N 天后自动完成
const COMPLETE_AFTER_DAYS = Number(process.env.COMPLETE_AFTER_DAYS ?? "7");

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threshold = new Date(
      Date.now() - COMPLETE_AFTER_DAYS * 24 * 60 * 60 * 1000
    );

    const readyOrders = await prisma.order.findMany({
      where: {
        status: "RECEIVED",
        subOrders: {
          every: {
            receivedAt: { not: null, lt: threshold },
          },
        },
      },
      take: 100,
    });

    let completed = 0;
    for (const order of readyOrders) {
      try {
        await completeOrder(order.id);
        completed++;
      } catch (e) {
        console.error(`Failed to complete order ${order.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      total: readyOrders.length,
      completed,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
