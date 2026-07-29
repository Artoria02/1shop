"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cancelOrderAction, confirmReceiptAction } from "@/server/actions/order.actions";
import { CountdownTimer } from "@/components/countdown-timer";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "待支付",
  PAID: "已支付",
  SHIPPED: "已发货",
  RECEIVED: "已收货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

interface SubItem {
  productName: string;
  productImage: string;
  skuSpecs: Record<string, string>;
  price: number;
  quantity: number;
  amount: number;
}

interface SubOrderDisplay {
  id: string;
  merchantName: string;
  totalAmount: number;
  status: string;
  items: SubItem[];
  shipment?: { carrier: string; trackingNo: string; shippedAt: string } | null;
}

export interface OrderDisplay {
  id: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  addressSnapshot: { receiverName: string; receiverPhone: string; province: string; city: string; district: string; detail: string };
  createdAt: string;
  expireAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  paidAt: string | null;
  subOrders: SubOrderDisplay[];
  payment?: { status: string; method: string; transactionId: string | null; paidAt: string | null } | null;
}

interface OrderDetailProps {
  order: OrderDisplay;
}

export default function OrderDetailClient({ order }: OrderDetailProps) {
  const [cancelState, cancelDispatch] = useActionState(cancelOrderAction, {});
  const [receiptState, receiptDispatch] = useActionState(confirmReceiptAction, {});

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>订单详情</h2>
        <Link href="/orders" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>← 返回列表</Link>
      </div>

      {/* Status banner */}
      <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 14, color: "#666" }}>订单状态：</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#e00" }}>{STATUS_LABELS[order.status] ?? order.status}</span>
          {order.status === "PENDING_PAYMENT" && order.expireAt && (
            <span style={{ fontSize: 13, marginLeft: 12 }}>
              请在 <CountdownTimer expireAt={order.expireAt} /> 内支付，逾期订单将自动取消
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {order.status === "PENDING_PAYMENT" && (
            <>
              <Link href={`/pay/${order.id}`} style={{ padding: "6px 20px", background: "#e00", color: "#fff", borderRadius: 4, textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                去支付
              </Link>
              <form action={cancelDispatch}>
                <input type="hidden" name="orderId" value={order.id} />
                <button type="submit" style={{ padding: "6px 20px", background: "#f0f0f0", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
                  取消订单
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {cancelState.error && (
        <div style={{ background: "#fff0f0", color: "#c00", padding: "8px 12px", marginBottom: 12, borderRadius: 4, fontSize: 13 }}>{cancelState.error}</div>
      )}
      {receiptState.error && (
        <div style={{ background: "#fff0f0", color: "#c00", padding: "8px 12px", marginBottom: 12, borderRadius: 4, fontSize: 13 }}>{receiptState.error}</div>
      )}

      {/* Order info */}
      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
          订单号：{order.orderNo}
          <span style={{ marginLeft: 16 }}>创建时间：{new Date(order.createdAt).toLocaleString("zh-CN")}</span>
          {order.paidAt && <span style={{ marginLeft: 16 }}>支付时间：{new Date(order.paidAt).toLocaleString("zh-CN")}</span>}
        </div>
      </div>

      {/* Address */}
      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>收货信息</div>
        <div style={{ fontSize: 13, color: "#666" }}>
          {order.addressSnapshot.receiverName} {order.addressSnapshot.receiverPhone}
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>
          {order.addressSnapshot.province}{order.addressSnapshot.city}{order.addressSnapshot.district} {order.addressSnapshot.detail}
        </div>
      </div>

      {/* Sub orders */}
      {order.subOrders.map((sub) => (
        <div key={sub.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f0f0f0" }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{sub.merchantName}</span>
            <span style={{ fontSize: 13, color: "#666" }}>{STATUS_LABELS[sub.status]}</span>
          </div>

          {sub.items.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ width: 56, height: 56, background: "#f5f5f5", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                {item.productImage ? (
                  <img src={item.productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{item.productName}</div>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {Object.values(item.skuSpecs).join(" / ")}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>x{item.quantity}</div>
              <div style={{ fontSize: 13 }}>¥{(item.price / 100).toFixed(2)}</div>
            </div>
          ))}

          {/* Shipment info */}
          {sub.shipment && (
            <div style={{ background: "#f9f9f9", padding: "8px 12px", borderRadius: 4, marginTop: 8, fontSize: 13, color: "#666" }}>
              物流：{sub.shipment.carrier} · {sub.shipment.trackingNo}
              <span style={{ marginLeft: 8 }}>
                发货时间：{new Date(sub.shipment.shippedAt).toLocaleString("zh-CN")}
              </span>
            </div>
          )}

          {/* Confirm receipt button */}
          {sub.status === "SHIPPED" && (
            <form action={receiptDispatch} style={{ textAlign: "right", marginTop: 8 }}>
              <input type="hidden" name="subOrderId" value={sub.id} />
              <button
                type="submit"
                style={{ padding: "6px 20px", background: "#e00", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                确认收货
              </button>
            </form>
          )}

          <div style={{ textAlign: "right", fontSize: 13, color: "#666", marginTop: 8 }}>
            小计：¥{(sub.totalAmount / 100).toFixed(2)}
          </div>
        </div>
      ))}

      {/* Total */}
      <div style={{ textAlign: "right", fontSize: 16, fontWeight: 600, padding: "16px 0" }}>
        订单总额：<span style={{ color: "#e00" }}>¥{(order.totalAmount / 100).toFixed(2)}</span>
      </div>

      {/* Payment info */}
      {order.payment && (
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>支付信息</div>
          <div style={{ fontSize: 13, color: "#666" }}>
            支付方式：{order.payment.method === "WECHAT_PAY" ? "微信支付" : "支付宝"}
            {order.payment.transactionId && (
              <span style={{ marginLeft: 16 }}>交易号：{order.payment.transactionId}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
