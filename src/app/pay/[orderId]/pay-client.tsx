"use client";

import Link from "next/link";

export default function PayClient({
  orderNo,
  totalAmount,
  payUrl,
}: {
  orderId: string;
  orderNo: string;
  totalAmount: number;
  payUrl: string;
}) {
  return (
    <div style={{ maxWidth: 500, margin: "60px auto", padding: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, textAlign: "center" }}>订单支付</h2>

      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
          <div>订单号：{orderNo}</div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>应付金额</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#e00" }}>
            ¥{(totalAmount / 100).toFixed(2)}
          </div>
        </div>

        {/* Mock payment methods */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>选择支付方式</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "2px solid #e00", borderRadius: 6, marginBottom: 8, cursor: "pointer" }}>
            <input type="radio" name="method" value="WECHAT_PAY" defaultChecked style={{ margin: 0 }} />
            <span style={{ fontSize: 14 }}>微信支付（Mock）</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid #eee", borderRadius: 6, cursor: "pointer" }}>
            <input type="radio" name="method" value="ALIPAY" style={{ margin: 0 }} />
            <span style={{ fontSize: 14 }}>支付宝（Mock）</span>
          </label>
        </div>

        {/* Pay button */}
        <a
          href={payUrl}
          style={{
            display: "block",
            width: "100%",
            padding: "12px 0",
            background: "#e00",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 16,
            textAlign: "center",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          立即支付
        </a>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/orders" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>
            稍后支付
          </Link>
        </div>
      </div>
    </div>
  );
}
