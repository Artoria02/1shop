import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { findOrdersByBuyer } from "@/server/services/order.service";
import OrdersClient from "./orders-client";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const user = await getSessionUser("BUYER");
  if (!user) redirect("/index/login");

  const params = await searchParams;
  const page = parseInt(params.page ?? "1");
  const status = params.status as string | undefined;

  const result = await findOrdersByBuyer(user.userId, {
    page,
    pageSize: 10,
    status: status as import("@prisma/client").OrderStatus | undefined,
  });

  const orders = result.items.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    totalAmount: order.totalAmount,
    status: order.status as string,
    createdAt: order.createdAt.toISOString(),
    expireAt: order.expireAt?.toISOString() ?? null,
    subOrders: order.subOrders,
    payment: order.payment,
  }));

  return <OrdersClient orders={orders} total={result.total} page={page} currentStatus={status} />;
}
