import { requireSessionUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { findOrderById } from "@/server/services/order.service";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "待支付",
  PAID: "已支付",
  SHIPPED: "已发货",
  RECEIVED: "已收货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser("PLATFORM_ADMIN");
  await requirePermission(user, "order:view");

  const { id } = await params;
  const order = await findOrderById(id);

  const address = order.addressSnapshot as {
    receiverName: string;
    receiverPhone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>订单详情</h2>
        <Link href="/admin/orders" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>
          ← 返回列表
        </Link>
      </div>

      {/* Order overview */}
      <div style={{ background: "#fafafa", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
          <div>
            <span style={{ color: "#999" }}>主订单号：</span>
            <span style={{ fontFamily: "monospace" }}>{order.orderNo}</span>
          </div>
          <div>
            <span style={{ color: "#999" }}>状态：</span>
            <span style={{ fontWeight: 600 }}>{STATUS_LABELS[order.status] ?? order.status}</span>
          </div>
          <div>
            <span style={{ color: "#999" }}>买家ID：</span>
            <span>{order.buyerId}</span>
          </div>
          <div>
            <span style={{ color: "#999" }}>订单总额：</span>
            <span style={{ fontWeight: 600, color: "#e00" }}>¥{(order.totalAmount / 100).toFixed(2)}</span>
          </div>
          <div>
            <span style={{ color: "#999" }}>创建时间：</span>
            <span>{new Date(order.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <div>
            <span style={{ color: "#999" }}>支付时间：</span>
            <span>{order.paidAt ? new Date(order.paidAt).toLocaleString("zh-CN") : "-"}</span>
          </div>
          {order.cancelledAt && (
            <div>
              <span style={{ color: "#999" }}>取消时间：</span>
              <span>{new Date(order.cancelledAt).toLocaleString("zh-CN")}</span>
              {order.cancelReason && (
                <span style={{ marginLeft: 8, color: "#666" }}>（{order.cancelReason}）</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>收货信息</div>
        <div style={{ fontSize: 13, color: "#666" }}>
          {address.receiverName} {address.receiverPhone}
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>
          {address.province}{address.city}{address.district} {address.detail}
        </div>
      </div>

      {/* Sub orders */}
      {order.subOrders.map((sub) => (
        <div key={sub.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f0f0f0" }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{sub.merchantName}</span>
              <span style={{ fontSize: 12, color: "#999", marginLeft: 12, fontFamily: "monospace" }}>
                {sub.subOrderNo}
              </span>
            </div>
            <span style={{ fontSize: 13, color: "#666" }}>{STATUS_LABELS[sub.status]}</span>
          </div>

          {sub.items.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ width: 48, height: 48, background: "#f5f5f5", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                {item.productImage ? (
                  <img src={item.productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
              <div style={{ flex: 1, fontSize: 13 }}>{item.productName}</div>
              <div style={{ fontSize: 12, color: "#999" }}>x{item.quantity}</div>
              <div style={{ fontSize: 13 }}>¥{(item.price / 100).toFixed(2)}</div>
            </div>
          ))}

          {/* Shipment */}
          {sub.shipment && (
            <div style={{ background: "#f9f9f9", padding: "8px 12px", borderRadius: 4, marginTop: 8, fontSize: 12, color: "#666" }}>
              物流：{sub.shipment.carrier} · {sub.shipment.trackingNo} · 发货时间：{new Date(sub.shipment.shippedAt).toLocaleString("zh-CN")}
            </div>
          )}

          <div style={{ textAlign: "right", fontSize: 13, color: "#666", marginTop: 8 }}>
            小计：¥{(sub.totalAmount / 100).toFixed(2)}
          </div>
        </div>
      ))}

      {/* Payment info */}
      {order.payment && (
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>支付信息</div>
          <div style={{ fontSize: 13, color: "#666", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <div>支付方式：{order.payment.method === "WECHAT_PAY" ? "微信支付" : "支付宝"}</div>
            <div>支付状态：{order.payment.status}</div>
            <div>交易号：{order.payment.transactionId ?? "-"}</div>
            <div>支付时间：{order.payment.paidAt ? new Date(order.payment.paidAt).toLocaleString("zh-CN") : "-"}</div>
            <div>幂等键：<span style={{ fontFamily: "monospace", fontSize: 11 }}>{order.payment.idempotencyKey}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
