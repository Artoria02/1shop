import { findMany } from "@/server/services/product.service";
import { ProductStatus } from "@prisma/client";
import Link from "next/link";

const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回"
};

const statusColors: Record<string, string> = {
  DRAFT: "#6b7280",
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444"
};

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const status = params.status as ProductStatus | undefined;
  const search = params.search;

  const { items } = await findMany({ status, search });

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>商品审核</h1>

      <form key={`${status || ""}_${search || ""}`} style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select name="status" defaultValue={status || ""} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}>
          <option value="">全部状态</option>
          <option value="PENDING">待审核</option>
          <option value="APPROVED">已通过</option>
          <option value="REJECTED">已驳回</option>
        </select>
        <input name="search" defaultValue={search || ""} placeholder="搜索商品名称" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200 }} />
        <button type="submit" style={{ padding: "6px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>筛选</button>
        {(status || search) ? (
          <Link href="/admin/products" style={{ padding: "6px 14px", background: "#f3f4f6", color: "#333", borderRadius: 4, textDecoration: "none", fontSize: 13 }}>清除</Link>
        ) : null}
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>商品</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>商家</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>类目</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>状态</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>提交时间</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={p.mainImage} alt={p.name} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} />
                  {p.name}
                </div>
              </td>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{(p as unknown as { merchant?: { name: string } }).merchant?.name || "-"}</td>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{(p as unknown as { category?: { name: string } }).category?.name || "-"}</td>
              <td style={{ padding: "12px 16px" }}>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, color: "#fff", background: statusColors[p.status] || "#999" }}>
                  {statusLabels[p.status] || p.status}
                </span>
              </td>
              <td style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{new Date(p.createdAt).toLocaleString("zh-CN")}</td>
              <td style={{ padding: "12px 16px" }}>
                <Link href={`/admin/products/${p.id}`} style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>查看详情</Link>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
