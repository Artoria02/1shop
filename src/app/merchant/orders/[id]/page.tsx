import { requireSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { shipOrderFormAction } from "@/server/actions/merchant.order.actions";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "待支付",
  PAID: "已支付",
  SHIPPED: "已发货",
  RECEIVED: "已收货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

export default async function MerchantOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser("MERCHANT");
  if (!user.merchantId) redirect("/merchant");

  const { id } = await params;
  const subOrder = await prisma.subOrder.findUnique({
    where: { id },
    include: {
      items: true,
      shipment: true,
      order: true,
    },
  });

  if (!subOrder || subOrder.merchantId !== user.merchantId) {
    redirect("/merchant/orders");
  }

  const address = subOrder.order.addressSnapshot as {
    receiverName: string;
    receiverPhone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>订单详情</h2>
        <Link href="/merchant/orders" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>
          ← 返回列表
        </Link>
      </div>

      {/* Status */}
      <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: "#666" }}>订单状态：</span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{STATUS_LABELS[subOrder.status] ?? subOrder.status}</span>
        <span style={{ fontSize: 12, color: "#999", marginLeft: 16 }}>
          子订单号：{subOrder.subOrderNo}
        </span>
        <span style={{ fontSize: 12, color: "#999", marginLeft: 16 }}>
          主订单号：{subOrder.order.orderNo}
        </span>
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

      {/* Items */}
      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>商品明细</div>
        {subOrder.items.map((item) => (
          <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f5f5f5" }}>
            <div style={{ width: 56, height: 56, background: "#f5f5f5", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
              {item.productImage ? (
                <img src={item.productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : null}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{item.productName}</div>
              <div style={{ fontSize: 12, color: "#999" }}>SKU: {item.skuCode}</div>
            </div>
            <div style={{ fontSize: 13, color: "#666" }}>x{item.quantity}</div>
            <div style={{ fontSize: 13 }}>¥{(item.price / 100).toFixed(2)}</div>
          </div>
        ))}
        <div style={{ textAlign: "right", fontSize: 14, fontWeight: 600, marginTop: 8 }}>
          小计：¥{(subOrder.totalAmount / 100).toFixed(2)}
        </div>
      </div>

      {/* Shipment info */}
      {subOrder.shipment && (
        <div style={{ background: "#f0fff4", border: "1px solid #b7eb8f", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#389e0d" }}>已发货</div>
          <div style={{ fontSize: 13, color: "#666" }}>
            快递公司：{subOrder.shipment.carrier} · 运单号：{subOrder.shipment.trackingNo}
          </div>
          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            发货时间：{new Date(subOrder.shipment.shippedAt).toLocaleString("zh-CN")}
          </div>
        </div>
      )}

      {/* Ship form */}
      {subOrder.status === "PAID" && !subOrder.shipment && (
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>发货</div>
          <form action={shipOrderFormAction} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <input type="hidden" name="subOrderId" value={subOrder.id} />
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#666" }}>快递公司</label>
              <input
                name="carrier"
                required
                placeholder="如：顺丰速运"
                style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, width: 160 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#666" }}>运单号</label>
              <input
                name="trackingNo"
                required
                placeholder="运单号"
                style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, width: 200 }}
              />
            </div>
            <button
              type="submit"
              style={{ padding: "7px 24px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
            >
              确认发货
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
