import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { findOrderById } from "@/server/services/order.service";
import { createPayment } from "@/server/services/payment.service";
import PayClient from "./pay-client";

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getSessionUser("BUYER");
  if (!user) redirect("/index/login");

  const { orderId } = await params;
  const order = await findOrderById(orderId);

  if (order.buyerId !== user.userId) redirect("/orders");
  if (order.status !== "PENDING_PAYMENT") redirect(`/orders/${orderId}`);

  // Create payment
  const paymentResult = await createPayment(orderId, "WECHAT_PAY");

  return (
    <PayClient
      orderId={order.id}
      orderNo={order.orderNo}
      totalAmount={order.totalAmount}
      payUrl={paymentResult.payUrl}
    />
  );
}
