"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CountdownTimer } from "@/components/countdown-timer";

interface OrderSummary {
  id: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  createdAt: string | Date;
  expireAt: string | Date | null;
  subOrders: Array<{
    id: string;
    merchantName: string;
    status: string;
    totalAmount: number;
    items: Array<{
      productName: string;
      productImage: string;
      price: number;
      quantity: number;
    }>;
  }>;
  payment?: { status: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "待支付",
  PAID: "已支付",
  SHIPPED: "已发货",
  RECEIVED: "已收货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  REFUNDING: "退款中",
  REFUNDED: "已退款",
};

export default function OrdersClient({
  orders,
  total,
  page,
  currentStatus,
}: {
  orders: OrderSummary[];
  total: number;
  page: number;
  currentStatus?: string;
}) {
  const router = useRouter();
  const totalPages = Math.ceil(total / 10);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>我的订单</h2>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["", "PENDING_PAYMENT", "PAID", "SHIPPED", "RECEIVED", "COMPLETED", "CANCELLED"].map((s) => (
          <Link
            key={s}
            href={s ? `/orders?status=${s}` : "/orders"}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 13,
              textDecoration: "none",
              background: (currentStatus ?? "") === s ? "#e00" : "#f5f5f5",
              color: (currentStatus ?? "") === s ? "#fff" : "#666",
            }}
          >
            {STATUS_LABELS[s] ?? "全部"}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>暂无订单</p>
          <Link href="/products" style={{ color: "#666", textDecoration: "underline" }}>
            去逛逛
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {orders.map((order) => (
              <div
                key={order.id}
                style={{ border: "1px solid #eee", borderRadius: 8, background: "#fff", overflow: "hidden" }}
              >
                {/* Order header */}
                <div style={{ padding: "10px 16px", background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#666" }}>
                  <span>订单号：{order.orderNo}</span>
                  <span>{new Date(order.createdAt).toLocaleString("zh-CN")}</span>
                  <span style={{ color: "#e00", fontWeight: 500 }}>{STATUS_LABELS[order.status] ?? order.status}</span>
                </div>

                {/* Sub orders */}
                {order.subOrders.map((sub) => (
                  <div key={sub.id} style={{ padding: "12px 16px", borderTop: "1px solid #f0f0f0" }}>
                    <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
                      店铺：{sub.merchantName} · {STATUS_LABELS[sub.status]}
                    </div>
                    {sub.items.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <div style={{ width: 48, height: 48, background: "#f5f5f5", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                          {item.productImage ? (
                            <img src={item.productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : null}
                        </div>
                        <div style={{ flex: 1, fontSize: 13 }}>{item.productName}</div>
                        <div style={{ fontSize: 13, color: "#666" }}>x{item.quantity}</div>
                        <div style={{ fontSize: 13, color: "#e00" }}>¥{(item.price / 100).toFixed(2)}</div>
                      </div>
                    ))}
                    <div style={{ textAlign: "right", fontSize: 13, color: "#666" }}>
                      小计：¥{(sub.totalAmount / 100).toFixed(2)}
                    </div>
                  </div>
                ))}

                {/* Order footer */}
                <div style={{ padding: "10px 16px", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14 }}>
                    总计：<span style={{ color: "#e00", fontWeight: 600 }}>¥{(order.totalAmount / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {order.status === "PENDING_PAYMENT" && (
                      <>
                        {order.expireAt && (
                          <span style={{ fontSize: 12, color: "#666" }}>
                            请在 <CountdownTimer expireAt={order.expireAt} /> 内支付
                          </span>
                        )}
                        <Link
                          href={`/pay/${order.id}`}
                          style={{
                            padding: "6px 16px",
                            background: "#e00",
                            color: "#fff",
                            borderRadius: 4,
                            textDecoration: "none",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          去支付
                        </Link>
                      </>
                    )}
                    <Link
                      href={`/orders/${order.id}`}
                      style={{
                        padding: "6px 16px",
                        background: "#f0f0f0",
                        color: "#333",
                        borderRadius: 4,
                        textDecoration: "none",
                        fontSize: 13,
                      }}
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/orders?page=${p}${currentStatus ? `&status=${currentStatus}` : ""}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 4,
                    textDecoration: "none",
                    fontSize: 13,
                    background: p === page ? "#e00" : "#f0f0f0",
                    color: p === page ? "#fff" : "#333",
                  }}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
