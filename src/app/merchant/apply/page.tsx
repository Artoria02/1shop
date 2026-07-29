"use client";

import { useActionState, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { applyMerchantAction } from "@/server/actions/merchant.actions";

function UploadField({
  name,
  label,
  folder,
  value,
  onChange
}: {
  name: string;
  label: string;
  folder: string;
  value?: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (json.success && json.data?.url) {
          onChange(json.data.url);
        } else {
          alert(json.error?.message || "上传失败");
        }
      } catch {
        alert("上传出错");
      } finally {
        setUploading(false);
      }
    },
    [folder, onChange]
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>{label}</label>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {uploading && <span style={{ fontSize: 12, color: "#666" }}>上传中...</span>}
      {value && (
        <div style={{ marginTop: 4 }}>
          <img src={value} alt={label} style={{ maxWidth: 120, maxHeight: 120, borderRadius: 4, border: "1px solid #ddd" }} />
          <input type="hidden" name={name} value={value} />
        </div>
      )}
    </div>
  );
}

export default function MerchantApplyPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(applyMerchantAction, {});
  const [businessLicense, setBusinessLicense] = useState("");
  const [legalPersonIdCard, setLegalPersonIdCard] = useState("");
  const [logo, setLogo] = useState("");

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        router.push("/merchant/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  if (state.success) {
    return (
      <div
        onClick={() => router.push("/merchant/login")}
        style={{ maxWidth: 600, margin: "40px auto", padding: 24, background: "#fff", borderRadius: 8, textAlign: "center", cursor: "pointer" }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>申请已提交</h1>
        <p style={{ color: "#666", fontSize: 14 }}>您的商家入驻申请已提交，请等待平台审核。</p>
        <p style={{ color: "#999", fontSize: 12, marginTop: 12 }}>3 秒后自动跳转到登录页，或点击任意处立即跳转</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "24px auto", padding: 24, background: "#fff", borderRadius: 8 }}>
      <h1 style={{ fontSize: 20, marginBottom: 20 }}>商家入驻申请</h1>
      {state.error && <div style={{ color: "#c00", fontSize: 13, marginBottom: 16, padding: 10, background: "#fff0f0", borderRadius: 4 }}>{state.error}</div>}
      <form action={action}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>店铺名称 *</label>
          <input name="name" required maxLength={50} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>商家类型 *</label>
          <select name="type" required style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }}>
            <option value="ENTERPRISE">企业</option>
            <option value="INDIVIDUAL">个体工商户</option>
          </select>
        </div>

        <UploadField name="businessLicense" label="营业执照" folder="merchants" value={businessLicense} onChange={setBusinessLicense} />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>统一社会信用代码</label>
          <input name="registerNo" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>法人姓名</label>
          <input name="legalPersonName" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <UploadField name="legalPersonIdCard" label="法人身份证" folder="merchants" value={legalPersonIdCard} onChange={setLegalPersonIdCard} />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>联系人姓名 *</label>
          <input name="contactName" required style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>联系人手机 *</label>
          <input name="contactPhone" required style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>联系人邮箱</label>
          <input name="contactEmail" type="email" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <div style={{ marginBottom: 16, padding: 12, background: "#f8f9fa", borderRadius: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>结算账户（可选）</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 2, color: "#666" }}>开户名</label>
            <input name="bankAccountName" style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 2, color: "#666" }}>银行账号</label>
            <input name="bankAccountNo" style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 2, color: "#666" }}>开户行</label>
            <input name="bankName" style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4 }} />
          </div>
        </div>

        <UploadField name="logo" label="店铺Logo" folder="merchants" value={logo} onChange={setLogo} />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>店铺描述</label>
          <textarea name="description" rows={3} style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>店铺地址</label>
          <input name="address" style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }} />
        </div>

        <button
          type="submit"
          disabled={pending}
          style={{
            width: "100%",
            padding: "10px 0",
            background: pending ? "#ccc" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 14,
            cursor: pending ? "not-allowed" : "pointer"
          }}
        >
          {pending ? "提交中..." : "提交入驻申请"}
        </button>
      </form>
    </div>
  );
}
