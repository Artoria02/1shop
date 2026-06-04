import { findById } from "@/server/services/merchant.service";
import { NotFoundError } from "@/lib/errors";
import Link from "next/link";
import { ReviewForm } from "./_components/review-form";

const statusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  DISABLED: "已禁用"
};

export default async function AdminMerchantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let merchant;
  try {
    merchant = await findById(id);
  } catch (e) {
    if (e instanceof NotFoundError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#999" }}>商家不存在</p>
          <Link href="/admin/merchants" style={{ color: "#2563eb", fontSize: 14 }}>返回列表</Link>
        </div>
      );
    }
    throw e;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/merchants" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>← 返回列表</Link>
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{merchant.name}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <InfoCard title="基本信息">
          <Row label="店铺名称" value={merchant.name} />
          <Row label="商家类型" value={merchant.type === "ENTERPRISE" ? "企业" : "个体工商户"} />
          <Row label="当前状态" value={statusLabels[merchant.status] || merchant.status} />
          <Row label="佣金比例" value={`${(merchant.commissionRate / 100).toFixed(2)}%`} />
          {merchant.rejectionReason && <Row label="驳回原因" value={merchant.rejectionReason} />}
        </InfoCard>

        <InfoCard title="联系信息">
          <Row label="联系人" value={merchant.contactName} />
          <Row label="手机号" value={merchant.contactPhone} />
          <Row label="邮箱" value={merchant.contactEmail || "-"} />
          <Row label="地址" value={merchant.address || "-"} />
        </InfoCard>

        <InfoCard title="资质信息">
          <Row label="统一社会信用代码" value={merchant.registerNo || "-"} />
          <Row label="法人姓名" value={merchant.legalPersonName || "-"} />
          {merchant.businessLicense && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>营业执照</div>
              <img src={merchant.businessLicense} alt="营业执照" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 4, border: "1px solid #eee" }} />
            </div>
          )}
          {merchant.legalPersonIdCard && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>法人身份证</div>
              <img src={merchant.legalPersonIdCard} alt="法人身份证" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 4, border: "1px solid #eee" }} />
            </div>
          )}
        </InfoCard>

        <InfoCard title="结算账户">
          <Row label="开户名" value={merchant.bankAccountName || "-"} />
          <Row label="银行账号" value={merchant.bankAccountNo || "-"} />
          <Row label="开户行" value={merchant.bankName || "-"} />
        </InfoCard>
      </div>

      <ReviewForm merchantId={merchant.id} status={merchant.status} />
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#333" }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: 13, color: "#666" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#333", maxWidth: "60%", textAlign: "right" }}>{value}</span>
    </div>
  );
}
