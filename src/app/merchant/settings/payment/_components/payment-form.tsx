"use client";

import { useActionState } from "react";
import { updatePaymentAction } from "@/server/actions/merchant.settings.actions";
import type { Merchant } from "@prisma/client";

export default function PaymentForm({ merchant }: { merchant: Merchant }) {
  const [state, action, pending] = useActionState(updatePaymentAction, {});

  const fields = [
    { label: "开户名称", name: "bankAccountName", value: merchant.bankAccountName ?? "", placeholder: "请输入开户名称" },
    { label: "银行账号", name: "bankAccountNo", value: merchant.bankAccountNo ?? "", placeholder: "请输入银行账号" },
    { label: "开户银行", name: "bankName", value: merchant.bankName ?? "", placeholder: "请输入开户银行" },
  ];

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
        <section style={{ marginBottom: 24, padding: 24, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#111" }}>资金与支付设置</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", maxWidth: 640 }}>
            {fields.map((f) => (
              <div key={f.name}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>{f.label}</label>
                <input
                  name={f.name}
                  defaultValue={f.value}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            ))}
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
