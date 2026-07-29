"use client";

import { useActionState, useState, useRef, useEffect, startTransition } from "react";
import Link from "next/link";
import {
  merchantLoginAction,
  merchantPhoneLoginAction,
  sendSmsCodeAction,
  type LoginState,
  type SmsCodeState
} from "@/server/actions/auth.actions";

const loginInitial: LoginState = {};
const smsInitial: SmsCodeState = {};

type LoginMode = "phone" | "password";

export default function MerchantLoginPage() {
  const [mode, setMode] = useState<LoginMode>("phone");

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>商家后台登录</h1>

      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e0e0e0" }}>
        <button
          type="button"
          onClick={() => setMode("phone")}
          style={{
            flex: 1,
            padding: "10px 0",
            fontSize: 14,
            fontWeight: mode === "phone" ? 600 : 400,
            color: mode === "phone" ? "#111" : "#999",
            background: "none",
            border: "none",
            borderBottom: mode === "phone" ? "2px solid #111" : "2px solid transparent",
            marginBottom: -2,
            cursor: "pointer"
          }}
        >
          手机登录
        </button>
        <button
          type="button"
          onClick={() => setMode("password")}
          style={{
            flex: 1,
            padding: "10px 0",
            fontSize: 14,
            fontWeight: mode === "password" ? 600 : 400,
            color: mode === "password" ? "#111" : "#999",
            background: "none",
            border: "none",
            borderBottom: mode === "password" ? "2px solid #111" : "2px solid transparent",
            marginBottom: -2,
            cursor: "pointer"
          }}
        >
          账号密码登录
        </button>
      </div>

      {mode === "phone" ? <PhoneLoginForm /> : <PasswordLoginForm />}

      <p style={{ marginTop: 16, fontSize: 13, color: "#666", textAlign: "center" }}>
        还没有店铺？
        <Link href="/merchant/apply" style={{ color: "#111", fontWeight: 500 }}>申请入驻</Link>
      </p>
    </div>
  );
}

function PasswordLoginForm() {
  const [state, formAction] = useActionState(merchantLoginAction, loginInitial);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {state?.error && (
        <p style={{ color: "#d32f2f", fontSize: 13, margin: 0, padding: "8px 12px", background: "#fdecea", borderRadius: 4 }}>
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="account" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>账号</label>
        <input id="account" name="account" type="text" required autoComplete="username"
          placeholder="邮箱 / 手机号 / 账号名"
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
  );
}

function PhoneLoginForm() {
  const [loginState, loginAction] = useActionState(merchantPhoneLoginAction, loginInitial);
  const [smsState, smsAction] = useActionState(sendSmsCodeAction, smsInitial);
  const [countdown, setCountdown] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingSmsRef = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!pendingSmsRef.current) return;
    if (smsState?.sent) {
      setCountdown(60);
      pendingSmsRef.current = false;
    }
    if (smsState?.error) {
      pendingSmsRef.current = false;
    }
  }, [smsState]);

  return (
    <form ref={formRef} action={loginAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loginState?.error && (
        <p style={{ color: "#d32f2f", fontSize: 13, margin: 0, padding: "8px 12px", background: "#fdecea", borderRadius: 4 }}>
          {loginState.error}
        </p>
      )}
      {smsState?.error && (
        <p style={{ color: "#d32f2f", fontSize: 13, margin: 0, padding: "8px 12px", background: "#fdecea", borderRadius: 4 }}>
          {smsState.error}
        </p>
      )}
      {smsState?.sent && (
        <p style={{ color: "#2e7d32", fontSize: 13, margin: 0, padding: "8px 12px", background: "#e8f5e9", borderRadius: 4 }}>
          验证码已发送，请注意查收
        </p>
      )}
      <div>
        <label htmlFor="phone" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>手机号</label>
        <input id="phone" name="phone" type="tel" required autoComplete="tel"
          placeholder="请输入手机号"
          style={{ width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
      </div>
      <div>
        <label htmlFor="code" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>验证码</label>
        <div style={{ display: "flex", gap: 12 }}>
          <input id="code" name="code" type="text" required autoComplete="one-time-code" maxLength={6}
            placeholder="6位验证码"
            style={{ flex: 1, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
          <button
            type="button"
            disabled={countdown > 0}
            onClick={() => {
              const phoneInput = formRef.current?.querySelector<HTMLInputElement>("#phone");
              const phone = phoneInput?.value ?? "";
              if (!phone) return;
              const fd = new FormData();
              fd.set("phone", phone);
              pendingSmsRef.current = true;
              startTransition(() => {
                smsAction(fd);
              });
            }}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              whiteSpace: "nowrap",
              cursor: countdown > 0 ? "default" : "pointer",
              background: countdown > 0 ? "#eee" : "#111",
              color: countdown > 0 ? "#999" : "#fff",
              border: "none",
              borderRadius: 4
            }}
          >
            {countdown > 0 ? `${countdown}s` : "获取验证码"}
          </button>
        </div>
      </div>
      <button type="submit" style={{ padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#111", color: "#fff", border: "none", borderRadius: 4 }}>
        登录
      </button>
    </form>
  );
}
