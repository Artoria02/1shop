"use client";

import { useState, useEffect, useActionState } from "react";
import {
  changePasswordAction,
  setPasswordAction,
  changeEmailAction,
  changePhoneAction,
} from "@/server/actions/merchant.settings.actions";
import { addStaffAction, removeStaffAction } from "@/server/actions/merchant.staff.actions";

type State = { error?: string; success?: string };

function EditRow({
  label,
  value,
  placeholder,
  actionLabel,
  children,
}: {
  label: string;
  value: string;
  placeholder?: string;
  actionLabel: string;
  children: (setEditing: (v: boolean) => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ width: 80, flexShrink: 0, fontSize: 14, color: "#666" }}>{label}</span>
        <span style={{ flex: 1, fontSize: 14, color: value ? "#111" : "#bbb" }}>{value || placeholder || "未设置"}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            padding: "4px 14px",
            background: "transparent",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            color: "#666",
          }}
        >
          {actionLabel}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <span style={{ width: 80, flexShrink: 0, fontSize: 14, color: "#666" }}>{label}</span>
        <span style={{ flex: 1, fontSize: 14, color: "#111" }}>{value || placeholder || "未设置"}</span>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{
            padding: "4px 14px",
            background: "transparent",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            color: "#999",
          }}
        >
          取消
        </button>
      </div>
      {children(setEditing)}
    </div>
  );
}

function FormFeedback({ state }: { state: State }) {
  return (
    <>
      {state?.error && (
        <div style={{ marginBottom: 10, padding: "6px 10px", background: "#fff0f0", color: "#c00", borderRadius: 4, fontSize: 12 }}>
          {state.error}
        </div>
      )}
      {state?.success && (
        <div style={{ marginBottom: 10, padding: "6px 10px", background: "#ecfdf5", color: "#065f46", borderRadius: 4, fontSize: 12 }}>
          {state.success}
        </div>
      )}
    </>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "7px 20px",
        background: pending ? "#ccc" : "#111",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        cursor: pending ? "not-allowed" : "pointer",
        fontSize: 13,
      }}
    >
      {pending ? "保存中..." : (label ?? "确认")}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 320,
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: 14,
  boxSizing: "border-box",
};

type StaffItem = {
  id: string;
  nickname: string;
  phone: string;
  displayName: string | null;
  status: string;
  createdAt: Date;
  online: boolean;
};

export default function AccountForm({
  isOwner,
  email,
  phone,
  hasPassword,
  staffs,
}: {
  isOwner: boolean;
  email: string;
  phone: string;
  hasPassword: boolean;
  staffs: StaffItem[];
}) {
  return (
    <div>
      <section style={{ marginBottom: 32, padding: 24, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: "#111" }}>安全中心</h2>

        {/* Email - only for owner */}
        {isOwner && (
          <EditRow label="邮箱" value={email} placeholder="未设置" actionLabel="修改">
            {(setEditing) => (
              <EmailEditForm setEditing={setEditing} />
            )}
          </EditRow>
        )}

        {/* Phone */}
        <EditRow label="手机号" value={phone} placeholder="未设置" actionLabel="修改">
          {(setEditing) => (
            <PhoneEditForm setEditing={setEditing} />
          )}
        </EditRow>

        {/* Password */}
        {hasPassword ? (
          <EditRow label="密码" value="******" actionLabel="修改">
            {(setEditing) => (
              <PasswordEditForm setEditing={setEditing} isSet={false} />
            )}
          </EditRow>
        ) : (
          <EditRow label="密码" value="" placeholder="未设置" actionLabel="设置">
            {(setEditing) => (
              <PasswordEditForm setEditing={setEditing} isSet={true} />
            )}
          </EditRow>
        )}
      </section>

      {/* 子账号管理 — only for owner */}
      {isOwner && (
        <section style={{ padding: 24, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#111" }}>子账号管理</h2>

          <AddStaffInlineForm />

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>昵称</th>
                <th style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>手机号</th>
                <th style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>在线状态</th>
                <th style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {staffs.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px", fontSize: 14 }}>{s.nickname}</td>
                  <td style={{ padding: "10px 14px", fontSize: 14 }}>{s.phone}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      color: s.online ? "#16a34a" : "#9ca3af",
                    }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: s.online ? "#16a34a" : "#d1d5db",
                        display: "inline-block",
                        flexShrink: 0,
                      }} />
                      {s.online ? "在线" : "离线"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <form action={removeStaffAction} style={{ display: "inline" }}>
                      <input type="hidden" name="staffId" value={s.id} />
                      <button type="submit" style={{ fontSize: 12, background: "none", border: "none", color: "#c00", cursor: "pointer", padding: 0 }}>
                        删除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {staffs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#999", fontSize: 14 }}>暂无子账号</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function EmailEditForm({ setEditing }: { setEditing: (v: boolean) => void }) {
  const [state, formAction, pending] = useActionState(changeEmailAction, {});

  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state, setEditing]);

  return (
    <form action={formAction}>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>新邮箱</label>
        <input name="email" type="email" required placeholder="请输入新邮箱" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>当前密码</label>
        <input name="password" type="password" required placeholder="请输入密码以验证身份" style={inputStyle} />
      </div>
      <FormFeedback state={state} />
      <SubmitButton pending={pending} />
    </form>
  );
}

function PhoneEditForm({ setEditing }: { setEditing: (v: boolean) => void }) {
  const [state, formAction, pending] = useActionState(changePhoneAction, {});

  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state, setEditing]);

  return (
    <form action={formAction}>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>新手机号</label>
        <input name="phone" type="tel" required placeholder="请输入新手机号" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>当前密码</label>
        <input name="password" type="password" required placeholder="请输入密码以验证身份" style={inputStyle} />
      </div>
      <FormFeedback state={state} />
      <SubmitButton pending={pending} />
    </form>
  );
}

function PasswordEditForm({ setEditing, isSet }: { setEditing: (v: boolean) => void; isSet: boolean }) {
  const action = isSet ? setPasswordAction : changePasswordAction;
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state, setEditing]);

  return (
    <form action={formAction}>
      {!isSet && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>原密码</label>
          <input name="oldPassword" type="password" required placeholder="请输入原密码" style={inputStyle} />
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>新密码</label>
        <input name="newPassword" type="password" required minLength={6} placeholder="至少6位" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#333" }}>确认新密码</label>
        <input name="confirmPassword" type="password" required minLength={6} placeholder="请再次输入" style={inputStyle} />
      </div>
      <FormFeedback state={state} />
      <SubmitButton pending={pending} />
    </form>
  );
}

function AddStaffInlineForm() {
  const [state, action, pending] = useActionState(addStaffAction, {});

  return (
    <div style={{ marginBottom: 20 }}>
      {state.success && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#ecfdf5", color: "#065f46", borderRadius: 4, fontSize: 12 }}>
          子账号添加成功，账号名和初始密码已通过短信发送至对应手机号。
        </div>
      )}
      {state.error && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fff0f0", color: "#c00", borderRadius: 4, fontSize: 12 }}>
          {state.error}
        </div>
      )}

      <form
        action={action}
        style={{ display: "flex", gap: 12, alignItems: "flex-end", padding: 14, background: "#f8f9fa", borderRadius: 6 }}
      >
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#333" }}>账号昵称</label>
          <input
            name="nickname"
            required
            placeholder="如 客服小王、运营01"
            style={{ width: "100%", padding: "7px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#333" }}>手机号</label>
          <input
            name="phone"
            type="tel"
            required
            placeholder="请输入员工手机号"
            style={{ width: "100%", padding: "7px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "7px 16px",
            background: pending ? "#ccc" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: pending ? "not-allowed" : "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {pending ? "添加中..." : "添加子账号"}
        </button>
      </form>
    </div>
  );
}
