"use client";
import { useActionState } from "react";
import { merchantLoginAction, type LoginState } from "@/server/actions/auth.actions";

const initialState: LoginState = {};

export default function MerchantLoginPage() {
  const [state, formAction] = useActionState(merchantLoginAction, initialState);

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>商家后台登录</h1>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {state?.error && (
          <p style={{ color: "#d32f2f", fontSize: 13, margin: 0, padding: "8px 12px", background: "#fdecea", borderRadius: 4 }}>
            {state.error}
          </p>
        )}
        <div>
          <label htmlFor="email" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>邮箱</label>
          <input id="email" name="email" type="email" required autoComplete="email"
            style={{ width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div>
          <label htmlFor="password" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>密码</label>
          <input id="password" name="password" type="password" required autoComplete="current-password"
            style={{ width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <button type="submit" style={{ padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#111", color: "#fff", border: "none", borderRadius: 4 }}>
          登录
        </button>
      </form>
    </div>
  );
}
