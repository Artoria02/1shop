import { findMany } from "@/server/services/merchant.service";
import { MerchantStatus } from "@prisma/client";
import Link from "next/link";

const statusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  DISABLED: "已禁用"
};

const statusColors: Record<string, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  DISABLED: "#6b7280"
};

export default async function AdminMerchantsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status as MerchantStatus | undefined;
  const search = params.search;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const { items, total, pageSize } = await findMany({ status, search, page });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>商家审核</h1>

      <form key={`${status || ""}_${search || ""}_${page}`} style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select name="status" defaultValue={status || ""} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}>
          <option value="">全部状态</option>
          <option value="PENDING">待审核</option>
          <option value="APPROVED">已通过</option>
          <option value="REJECTED">已拒绝</option>
          <option value="DISABLED">已禁用</option>
        </select>
        <input name="search" defaultValue={search || ""} placeholder="搜索店铺名称/注册号" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200 }} />
        <button type="submit" style={{ padding: "6px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>筛选</button>
        {search || status ? (
          <Link href="/admin/merchants" style={{ padding: "6px 14px", background: "#f3f4f6", color: "#333", borderRadius: 4, textDecoration: "none", fontSize: 13 }}>清除</Link>
        ) : null}
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>店铺名称</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>类型</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>状态</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>联系人</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>提交时间</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{m.name}</td>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{m.type === "ENTERPRISE" ? "企业" : "个体工商户"}</td>
              <td style={{ padding: "12px 16px" }}>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, color: "#fff", background: statusColors[m.status] || "#999" }}>
                  {statusLabels[m.status] || m.status}
                </span>
              </td>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>
                {m.contactName}
                <br />
                <span style={{ fontSize: 12, color: "#999" }}>{m.contactPhone}</span>
              </td>
              <td style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{new Date(m.createdAt).toLocaleString("zh-CN")}</td>
              <td style={{ padding: "12px 16px" }}>
                <Link href={`/admin/merchants/${m.id}`} style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>查看详情</Link>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#999", fontSize: 14 }}>暂无数据</td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/merchants?page=${p}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                background: p === page ? "#111" : "#f3f4f6",
                color: p === page ? "#fff" : "#333",
                textDecoration: "none",
                fontSize: 13
              }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
