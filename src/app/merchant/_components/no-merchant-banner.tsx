import Link from "next/link";

export default function NoMerchantBanner() {
  return (
    <div style={{ padding: 40, textAlign: "center", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>您还没有关联的店铺</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
        当前账号尚未绑定商家店铺，无法管理商品。请先提交商家入驻申请，等待平台审核通过后再试。
      </p>
      <Link
        href="/merchant/apply"
        style={{ padding: "10px 24px", background: "#111", color: "#fff", borderRadius: 4, textDecoration: "none", fontSize: 14 }}
      >
        申请入驻
      </Link>
    </div>
  );
}
