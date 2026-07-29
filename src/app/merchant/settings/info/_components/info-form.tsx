"use client";

import { useActionState } from "react";
import { updateInfoAction } from "@/server/actions/merchant.settings.actions";
import type { Merchant } from "@prisma/client";

export default function InfoForm({ merchant }: { merchant: Merchant }) {
  const [state, action, pending] = useActionState(updateInfoAction, {});

  const fields = [
    { label: "店铺名称", name: "name", required: true, value: merchant.name, placeholder: "请输入店铺名称" },
    { label: "店铺Logo", name: "logo", value: merchant.logo ?? "", placeholder: "Logo图片URL" },
    { label: "店铺简介", name: "description", value: merchant.description ?? "", placeholder: "请输入店铺简介" },
    { label: "店铺地址", name: "address", value: merchant.address ?? "", placeholder: "请输入店铺地址" },
    { label: "联系人姓名", name: "contactName", required: true, value: merchant.contactName, placeholder: "请输入联系人姓名" },
    { label: "联系人手机", name: "contactPhone", required: true, value: merchant.contactPhone, placeholder: "请输入联系人手机号" },
    { label: "联系人邮箱", name: "contactEmail", value: merchant.contactEmail ?? "", placeholder: "请输入联系人邮箱" },
  ];

  const qualFields = [
    { label: "营业执照号", name: "businessLicense", value: merchant.businessLicense ?? "", placeholder: "请输入营业执照号" },
    { label: "法人姓名", name: "legalPersonName", value: merchant.legalPersonName ?? "", placeholder: "请输入法人姓名" },
    { label: "法人身份证号", name: "legalPersonIdCard", value: merchant.legalPersonIdCard ?? "", placeholder: "请输入法人身份证号" },
    { label: "注册号", name: "registerNo", value: merchant.registerNo ?? "", placeholder: "请输入注册号" },
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
        {/* 店铺基础信息 */}
        <section style={{ marginBottom: 32, padding: 24, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#111" }}>店铺基础信息</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
            {fields.map((f) => (
              <div key={f.name} style={f.name === "description" || f.name === "address" ? { gridColumn: "span 2" } : undefined}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>
                  {f.label}{f.required ? " *" : ""}
                </label>
                <input
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 主体与资质信息 */}
        <section style={{ marginBottom: 24, padding: 24, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#111" }}>主体与资质信息</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
            {qualFields.map((f) => (
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
          <div style={{ marginTop: 12, fontSize: 12, color: "#999" }}>
            主体类型: {merchant.type === "ENTERPRISE" ? "企业" : "个人"}
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
