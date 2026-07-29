import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { findOrderById } from "@/server/services/order.service";
import OrderDetailClient from "./order-detail-client";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser("BUYER");
  if (!user) redirect("/index/login");

  const { id } = await params;
  const order = await findOrderById(id);

  if (order.buyerId !== user.userId) {
    redirect("/orders");
  }

  const displayOrder = {
    id: order.id,
    orderNo: order.orderNo,
    totalAmount: order.totalAmount,
    status: order.status as string,
    addressSnapshot: order.addressSnapshot as {
      receiverName: string;
      receiverPhone: string;
      province: string;
      city: string;
      district: string;
      detail: string;
    },
    createdAt: order.createdAt.toISOString(),
    expireAt: order.expireAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    subOrders: order.subOrders.map((sub) => ({
      id: sub.id,
      merchantName: sub.merchantName,
      totalAmount: sub.totalAmount,
      status: sub.status as string,
      items: sub.items,
      shipment: sub.shipment
        ? {
            carrier: sub.shipment.carrier,
            trackingNo: sub.shipment.trackingNo,
            shippedAt: sub.shipment.shippedAt.toISOString(),
          }
        : null,
    })),
    payment: order.payment
      ? {
          status: order.payment.status as string,
          method: order.payment.method as string,
          transactionId: order.payment.transactionId,
          paidAt: order.payment.paidAt?.toISOString() ?? null,
        }
      : null,
  };

  return <OrderDetailClient order={displayOrder as unknown as import("./order-detail-client").OrderDisplay} />;
}
