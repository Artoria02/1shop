"use client";

import { useActionState, useRef, useState, useEffect, startTransition } from "react";
import Link from "next/link";
import {
  registerAction,
  sendSmsCodeAction,
  type RegisterState,
  type SmsCodeState
} from "@/server/actions/auth.actions";

const registerInitial: RegisterState = {};
const smsInitial: SmsCodeState = {};

export default function BuyerRegisterPage() {
  const [regState, regAction] = useActionState(registerAction, registerInitial);
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
    <div style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>买家注册</h1>

      <form ref={formRef} action={regAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {regState?.error && (
          <p style={{ color: "#d32f2f", fontSize: 13, margin: 0, padding: "8px 12px", background: "#fdecea", borderRadius: 4 }}>
            {regState.error}
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
          <label htmlFor="phone" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>手机号 *</label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel"
            placeholder="请输入手机号"
            style={{ width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        <div>
          <label htmlFor="code" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>验证码 *</label>
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

        <div>
          <label htmlFor="email" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>邮箱（选填）</label>
          <input id="email" name="email" type="email" autoComplete="email"
            placeholder="选填"
            style={{ width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        <div>
          <label htmlFor="password" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>密码 *</label>
          <input id="password" name="password" type="password" required autoComplete="new-password" minLength={6}
            style={{ width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        <div>
          <label htmlFor="confirmPassword" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>确认密码 *</label>
          <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" minLength={6}
            style={{ width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        <button type="submit" style={{ padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#111", color: "#fff", border: "none", borderRadius: 4 }}>
          注册
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 13, color: "#666", textAlign: "center" }}>
        已有账号？
        <Link href="/index/login" style={{ color: "#111", fontWeight: 500 }}>去登录</Link>
      </p>
    </div>
  );
}
