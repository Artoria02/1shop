"use client";

import { useActionState } from "react";
import { addStaffAction } from "@/server/actions/merchant.staff.actions";

export default function AddStaffForm() {
  const [state, action, pending] = useActionState(addStaffAction, {});

  return (
    <div>
      {state.success && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            background: "#ecfdf5",
            color: "#065f46",
            borderRadius: 4,
            fontSize: 13
          }}
        >
          员工添加成功
          {state.isNewUser && (
            <span>，新账号初始密码为 <strong>123456</strong>，请通知员工及时修改</span>
          )}
        </div>
      )}
      {state.error && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            background: "#fff0f0",
            color: "#c00",
            borderRadius: 4,
            fontSize: 13
          }}
        >
          {state.error}
        </div>
      )}

      <form
        action={action}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 24,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>
            员工手机号
          </label>
          <input
            name="phone"
            type="tel"
            required
            placeholder="输入员工手机号"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 16px",
            background: pending ? "#ccc" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: pending ? "not-allowed" : "pointer",
            fontSize: 14
          }}
        >
          {pending ? "添加中..." : "添加员工"}
        </button>
      </form>
    </div>
  );
}
