"use client";

import { useActionState } from "react";
import { updateShippingAction } from "@/server/actions/merchant.settings.actions";
import type { Merchant } from "@prisma/client";

export default function ShippingForm({ merchant }: { merchant: Merchant }) {
  const [state, action, pending] = useActionState(updateShippingAction, {});

  return (
    <div>
      {state.success && (
        <div style={{ marginBottom: 16, padding: "10px 12px", background: "#ecfdf5", color: "#065f46", borderRadius: 4, fontSize: 13 }}>
          {state.success}
        </div>
      )}
      {state.error && (
        <div style={{ marginBottom: 16, padding: "10px 12px", background: "#fff0f0", color: "#c00", borderRadius: 4, fontSize: 13 }}>
          {state.error}
        </div>
      )}

      <form action={action}>
        {/* 发货/退货地址 */}
        <section style={{ marginBottom: 32, padding: 24, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#111" }}>发货/退货地址</h2>
          <p style={{ fontSize: 13, color: "#999", marginBottom: 16 }}>
            默认使用店铺地址作为发货/退货地址，如需修改请在下方更新。
          </p>
          <div style={{ maxWidth: 480 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>发货/退货地址 *</label>
            <input
              name="address"
              defaultValue={merchant.address ?? ""}
              required
              placeholder="请输入发货/退货地址"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
        </section>

        {/* 运费模板说明 */}
        <section style={{ marginBottom: 24, padding: 24, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#111" }}>运费设置</h2>
          <div style={{ padding: "24px 0", textAlign: "center", color: "#999", fontSize: 14 }}>
            <svg width={48} height={48} viewBox="0 0 24 24" fill="#ccc" style={{ marginBottom: 12 }}>
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
            <p>运费模板功能即将上线，届时可配置包邮门槛、区域运费等规则。</p>
            <p style={{ marginTop: 8, fontSize: 12 }}>当前所有订单运费由买家承担，默认快递发货。</p>
          </div>
        </section>

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "10px 32px",
            background: pending ? "#ccc" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: pending ? "not-allowed" : "pointer",
            fontSize: 14,
          }}
        >
          {pending ? "保存中..." : "保存修改"}
        </button>
      </form>
    </div>
  );
}
