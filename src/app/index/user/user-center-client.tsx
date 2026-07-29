"use client";

import { useActionState, useState, useRef, useEffect, startTransition } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";
import type { ShippingAddress } from "@prisma/client";

type UserProfile = SessionUser & {
  email: string | null;
  phone: string | null;
  avatar: string | undefined;
  displayName: string | undefined;
  hasPassword: boolean;
};
import {
  logoutAction,
  updateProfileAction,
  changeEmailAction,
  changePhoneAction,
  changePasswordAction,
  sendSmsCodeAction,
  type ProfileActionState,
  type SmsCodeState
} from "@/server/actions/auth.actions";
import {
  createAddressAction,
  updateAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  type AddressActionState
} from "@/server/actions/address.actions";

const profileInitial: ProfileActionState = {};
const addrInitial: AddressActionState = {};
const smsInitial: SmsCodeState = {};

type Tab = "profile" | "security" | "address";
type SecuritySection = "email" | "phone" | "password" | null;

export function UserCenterClient({ user, addresses }: { user: UserProfile; addresses: ShippingAddress[] }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div style={{ maxWidth: 860, margin: "32px auto", padding: "0 16px", display: "flex", gap: 28 }}>
      {/* Sidebar */}
      <aside style={{ width: 160, flexShrink: 0 }}>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {([
            ["profile", "个人资料"],
            ["security", "账号与安全"],
            ["address", "收货地址"]
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: tab === key ? 600 : 400,
                color: tab === key ? "#fff" : "#333",
                background: tab === key ? "#111" : "transparent",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              {label}
            </button>
          ))}
          <Link
            href="/orders"
            style={{
              textAlign: "left",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 400,
              color: "#333",
              background: "transparent",
              textDecoration: "none",
              borderRadius: 4,
            }}
          >
            我的订单
          </Link>
        </nav>
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #e0e0e0" }}>
          <Link href="/index" style={{ display: "block", padding: "10px 14px", fontSize: 13, color: "#666", textDecoration: "none", borderRadius: 4 }}>
            返回首页
          </Link>
          <form action={logoutAction}>
            <input type="hidden" name="redirectTo" value="/index" />
            <button type="submit" style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, color: "#d32f2f", background: "none", border: "none", cursor: "pointer", borderRadius: 4 }}>
              退出登录
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {tab === "profile" && <ProfileTab user={user} />}
        {tab === "security" && <SecurityTab user={user} />}
        {tab === "address" && <AddressTab addresses={addresses} />}
      </main>
    </div>
  );
}

// ── Profile Tab ──

function ProfileTab({ user }: { user: UserProfile }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(updateProfileAction, profileInitial);

  if (!editing) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
          <AvatarImage src={user.avatar} size={64} />
          <div>
            <h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>
              {user.displayName ?? user.email?.split("@")[0] ?? user.phone ?? "用户"}
            </h2>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <InfoRow label="昵称" value={user.displayName ?? "未设置"} />
          <InfoRow label="邮箱" value={user.email ?? "未绑定"} />
          <InfoRow label="手机号" value={user.phone ?? "未绑定"} />
        </div>

        <button type="button" onClick={() => setEditing(true)} style={{ ...btnStyle, marginTop: 24 }}>
          编辑资料
        </button>
      </div>
    );
  }

  return <ProfileEditForm user={user} state={state} formAction={formAction} onCancel={() => setEditing(false)} />;
}

function ProfileEditForm({ user, state, formAction, onCancel }: {
  user: UserProfile;
  state: ProfileActionState;
  formAction: (payload: FormData) => void;
  onCancel: () => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatar ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("folder", "avatars");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.data?.url) setAvatarUrl(json.data.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px", fontWeight: 600 }}>编辑资料</h2>
      {state?.error && <ErrorMsg msg={state.error} />}
      {state?.success && <SuccessMsg msg={state.success} />}

      <input type="hidden" name="avatar" value={avatarUrl} />

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
          <AvatarImage src={avatarUrl} size={64} />
          <span style={{ position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: "50%", background: "#111", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {uploading ? "..." : "+"}
          </span>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: "none" }} />
        <span style={{ fontSize: 12, color: "#999" }}>点击头像上传</span>
      </div>

      <Field label="昵称" htmlFor="displayName">
        <Input id="displayName" name="displayName" defaultValue={user.displayName ?? ""} />
      </Field>

      <Field label="邮箱">
        <Input disabled value={user.email ?? "未绑定"} style={{ color: "#999" }} />
      </Field>

      <Field label="手机号">
        <Input disabled value={user.phone ?? "未绑定"} style={{ color: "#999" }} />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" style={{ ...btnStyle, flex: 1 }}>保存</button>
        <button type="button" onClick={onCancel} style={{ ...btnStyle, flex: 1, background: "#fff", color: "#333", border: "1px solid #ddd" }}>
          取消
        </button>
      </div>
    </form>
  );
}

// ── Security Tab ──

function SecurityTab({ user }: { user: UserProfile }) {
  const [section, setSection] = useState<SecuritySection>(null);

  if (section === "email") return <ChangeEmailForm user={user} onBack={() => setSection(null)} />;
  if (section === "phone") return <ChangePhoneForm user={user} onBack={() => setSection(null)} />;
  if (section === "password") return <ChangePasswordForm hasPassword={user.hasPassword} onBack={() => setSection(null)} />;

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: "0 0 20px", fontWeight: 600 }}>账号与安全</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <SecurityRow label="邮箱" value={user.email ?? "未绑定"} action={user.email ? "更换" : "绑定"} onClick={() => setSection("email")} />
        <SecurityRow label="手机号" value={user.phone ?? "未绑定"} action={user.phone ? "更换" : "绑定"} onClick={() => setSection("phone")} />
        <SecurityRow label="密码" value={user.hasPassword ? "••••••" : "未设置"} action={user.hasPassword ? "更换" : "设置"} onClick={() => setSection("password")} />
      </div>
    </div>
  );
}

function SecurityRow({ label, value, action, onClick }: { label: string; value: string; action: string; onClick: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
      <span style={{ color: "#333", fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "#999" }}>{value}</span>
        <button type="button" onClick={onClick} style={{ fontSize: 12, color: "#111", background: "none", border: "1px solid #ddd", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
          {action}
        </button>
      </div>
    </div>
  );
}

function ChangeEmailForm({ user, onBack }: { user: UserProfile; onBack: () => void }) {
  const [state, formAction] = useActionState(changeEmailAction, profileInitial);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px", fontWeight: 600 }}>更换邮箱</h2>
      <p style={{ margin: 0, fontSize: 13, color: "#999" }}>当前邮箱：{user.email ?? "未绑定"}</p>
      {state?.error && <ErrorMsg msg={state.error} />}
      {state?.success && <SuccessMsg msg={state.success} />}

      <Field label="新邮箱" htmlFor="newEmail">
        <Input id="newEmail" name="newEmail" type="email" required />
      </Field>
      <Field label="当前密码（安全验证）" htmlFor="emailPassword">
        <Input id="emailPassword" name="password" type="password" required placeholder="输入密码以验证身份" />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" style={{ ...btnStyle, flex: 1 }}>确认更换</button>
        <button type="button" onClick={onBack} style={{ ...btnStyle, flex: 1, background: "#fff", color: "#333", border: "1px solid #ddd" }}>返回</button>
      </div>
    </form>
  );
}

function ChangePhoneForm({ user, onBack }: { user: UserProfile; onBack: () => void }) {
  const [state, formAction] = useActionState(changePhoneAction, profileInitial);
  const [smsState, smsAction] = useActionState(sendSmsCodeAction, smsInitial);
  const [countdown, setCountdown] = useState(0);
  const [newPhone, setNewPhone] = useState("");
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
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px", fontWeight: 600 }}>更换手机号</h2>
      <p style={{ margin: 0, fontSize: 13, color: "#999" }}>当前手机号：{user.phone ?? "未绑定"}</p>
      {state?.error && <ErrorMsg msg={state.error} />}
      {state?.success && <SuccessMsg msg={state.success} />}
      {smsState?.error && <ErrorMsg msg={smsState.error} />}
      {smsState?.sent && <SuccessMsg msg="验证码已发送，请注意查收" />}

      <Field label="新手机号" htmlFor="newPhone">
        <Input id="newPhone" name="newPhone" required value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
      </Field>

      <Field label="新手机号验证码">
        <div style={{ display: "flex", gap: 12 }}>
          <Input id="phoneCode" name="code" required maxLength={6} placeholder="6位验证码" />
          <button
            type="button"
            disabled={countdown > 0}
            onClick={() => {
              if (!newPhone) return;
              const fd = new FormData();
              fd.set("phone", newPhone);
              pendingSmsRef.current = true;
              startTransition(() => {
                smsAction(fd);
              });
            }}
            style={{
              padding: "8px 16px", fontSize: 13, whiteSpace: "nowrap",
              cursor: countdown > 0 ? "default" : "pointer",
              background: countdown > 0 ? "#eee" : "#111",
              color: countdown > 0 ? "#999" : "#fff",
              border: "none", borderRadius: 4
            }}
          >
            {countdown > 0 ? `${countdown}s` : "获取验证码"}
          </button>
        </div>
      </Field>

      <Field label="当前密码（安全验证）" htmlFor="phonePassword">
        <Input id="phonePassword" name="password" type="password" required placeholder="输入密码以验证身份" />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" style={{ ...btnStyle, flex: 1 }}>确认更换</button>
        <button type="button" onClick={onBack} style={{ ...btnStyle, flex: 1, background: "#fff", color: "#333", border: "1px solid #ddd" }}>返回</button>
      </div>
    </form>
  );
}

function ChangePasswordForm({ hasPassword, onBack }: { hasPassword: boolean; onBack: () => void }) {
  const [state, formAction] = useActionState(changePasswordAction, profileInitial);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px", fontWeight: 600 }}>{hasPassword ? "修改密码" : "设置密码"}</h2>
      {state?.error && <ErrorMsg msg={state.error} />}
      {state?.success && <SuccessMsg msg={state.success} />}

      {hasPassword && (
        <Field label="原密码" htmlFor="oldPassword">
          <Input id="oldPassword" name="oldPassword" type="password" required={hasPassword} />
        </Field>
      )}
      <Field label="新密码" htmlFor="newPassword">
        <Input id="newPassword" name="newPassword" type="password" required minLength={6} placeholder="至少6位" />
      </Field>
      <Field label="确认新密码" htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" style={{ ...btnStyle, flex: 1 }}>{hasPassword ? "修改" : "设置"}</button>
        <button type="button" onClick={onBack} style={{ ...btnStyle, flex: 1, background: "#fff", color: "#333", border: "1px solid #ddd" }}>返回</button>
      </div>
    </form>
  );
}

// ── Address Tab ──

function AddressTab({ addresses }: { addresses: ShippingAddress[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (editingId) {
    const addr = addresses.find((a) => a.id === editingId);
    return (
      <div>
        <h2 style={{ fontSize: 18, margin: "0 0 16px", fontWeight: 600 }}>编辑地址</h2>
        <AddressForm addr={addr} onCancel={() => setEditingId(null)} />
      </div>
    );
  }

  if (adding) {
    return (
      <div>
        <h2 style={{ fontSize: 18, margin: "0 0 16px", fontWeight: 600 }}>添加地址</h2>
        <AddressForm onCancel={() => setAdding(false)} />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: "0 0 16px", fontWeight: 600 }}>收货地址</h2>
      {addresses.length === 0 && (
        <p style={{ color: "#999", fontSize: 14, marginBottom: 16 }}>暂无收货地址</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {addresses.map((addr) => (
          <AddressCard key={addr.id} addr={addr} onEdit={() => setEditingId(addr.id)} />
        ))}
      </div>
      <button type="button" onClick={() => setAdding(true)} style={{ ...btnStyle, marginTop: 16, width: "100%" }}>
        添加新地址
      </button>
    </div>
  );
}

function AddressCard({ addr, onEdit }: { addr: ShippingAddress; onEdit: () => void }) {
  return (
    <div style={{ border: "1px solid #e0e0e0", borderRadius: 6, padding: 12, fontSize: 14 }}>
      {addr.isDefault && (
        <span style={{ fontSize: 11, color: "#d32f2f", border: "1px solid #d32f2f", borderRadius: 3, padding: "0 6px", marginRight: 8 }}>默认</span>
      )}
      <span style={{ fontWeight: 600 }}>{addr.receiverName}</span>
      <span style={{ color: "#666", marginLeft: 12 }}>{addr.receiverPhone}</span>
      <p style={{ margin: "6px 0 0", color: "#333" }}>
        {addr.province}{addr.city}{addr.district} {addr.detail}
      </p>
      <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
        <button type="button" onClick={onEdit} style={linkBtnStyle}>编辑</button>
        <DeleteAddrBtn id={addr.id} />
        {!addr.isDefault && <SetDefaultBtn id={addr.id} />}
      </div>
    </div>
  );
}

function DeleteAddrBtn({ id }: { id: string }) {
  const [, formAction] = useActionState(deleteAddressAction, addrInitial);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={{ ...linkBtnStyle, color: "#d32f2f" }}>删除</button>
    </form>
  );
}

function SetDefaultBtn({ id }: { id: string }) {
  const [, formAction] = useActionState(setDefaultAddressAction, addrInitial);
  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={linkBtnStyle}>设为默认</button>
    </form>
  );
}

function AddressForm({ addr, onCancel }: { addr?: ShippingAddress; onCancel: () => void }) {
  const action = addr ? updateAddressAction : createAddressAction;
  const [state, formAction] = useActionState(action, addrInitial);

  useEffect(() => {
    if (state.success) onCancel();
  }, [state.success, onCancel]);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {state?.error && <ErrorMsg msg={state.error} />}
      {addr && <input type="hidden" name="id" value={addr.id} />}

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="收件人" htmlFor="receiverName">
            <Input id="receiverName" name="receiverName" required defaultValue={addr?.receiverName ?? ""} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="手机号" htmlFor="receiverPhone">
            <Input id="receiverPhone" name="receiverPhone" required defaultValue={addr?.receiverPhone ?? ""} />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="省" htmlFor="province">
            <Input id="province" name="province" required defaultValue={addr?.province ?? ""} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="市" htmlFor="city">
            <Input id="city" name="city" required defaultValue={addr?.city ?? ""} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="区" htmlFor="district">
            <Input id="district" name="district" required defaultValue={addr?.district ?? ""} />
          </Field>
        </div>
      </div>

      <Field label="详细地址" htmlFor="detail">
        <Input id="detail" name="detail" required defaultValue={addr?.detail ?? ""} />
      </Field>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" name="isDefault" defaultChecked={addr?.isDefault ?? false} />
        设为默认地址
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" style={{ ...btnStyle, flex: 1 }}>{addr ? "保存" : "添加"}</button>
        <button type="button" onClick={onCancel} style={{ ...btnStyle, flex: 1, background: "#fff", color: "#333", border: "1px solid #ddd" }}>
          取消
        </button>
      </div>
    </form>
  );
}

// ── Shared UI ──

function AvatarImage({ src, size }: { src?: string | null; size: number }) {
  if (src) {
    return <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  const iconSize = Math.round(size * 0.6);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "#e8e8e8",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
    }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#555">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
      <span style={{ color: "#999" }}>{label}</span>
      <span style={{ color: "#333" }}>{value}</span>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      {htmlFor ? <label htmlFor={htmlFor} style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>{label}</label> : null}
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%", padding: "8px 12px", fontSize: 14, boxSizing: "border-box",
        border: "1px solid #ddd", borderRadius: 4, ...props.style
      }}
    />
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p style={{ color: "#d32f2f", fontSize: 13, margin: 0, padding: "8px 12px", background: "#fdecea", borderRadius: 4 }}>{msg}</p>;
}

function SuccessMsg({ msg }: { msg: string }) {
  return <p style={{ color: "#2e7d32", fontSize: 13, margin: 0, padding: "8px 12px", background: "#e8f5e9", borderRadius: 4 }}>{msg}</p>;
}

const btnStyle: React.CSSProperties = {
  padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  background: "#111", color: "#fff", border: "none", borderRadius: 4
};

const linkBtnStyle: React.CSSProperties = {
  fontSize: 12, color: "#666", background: "none", border: "none", cursor: "pointer", padding: 0
};
