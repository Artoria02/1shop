import { findMany } from "@/server/services/product.service";
import { requireSessionUser } from "@/lib/auth";
import Link from "next/link";
import { ProductStatus, ProductSaleStatus } from "@prisma/client";
import { toggleProductSaleStatusAction, deleteProductAction } from "@/server/actions/merchant.product.actions";

const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PENDING: "审核中",
  APPROVED: "已通过",
  REJECTED: "已驳回"
};

const statusColors: Record<string, string> = {
  DRAFT: "#6b7280",
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444"
};

export default async function MerchantProductsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; saleStatus?: string; search?: string }>;
}) {
  const user = await requireSessionUser();

  const params = await searchParams;
  const status = params.status as ProductStatus | undefined;
  const saleStatus = params.saleStatus as ProductSaleStatus | undefined;
  const search = params.search;

  const { items } = await findMany({ merchantId: user.merchantId, status, saleStatus, search });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>商品管理</h1>
        <Link
          href="/merchant/products/create"
          style={{ padding: "8px 16px", background: "#111", color: "#fff", borderRadius: 4, textDecoration: "none", fontSize: 13 }}
        >
          + 发布商品
        </Link>
      </div>

      <form key={`${status || ""}_${saleStatus || ""}_${search || ""}`} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input name="search" defaultValue={search || ""} placeholder="搜索商品名称" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 180 }} />
        <select name="status" defaultValue={status || ""} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}>
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PENDING">审核中</option>
          <option value="APPROVED">已通过</option>
          <option value="REJECTED">已驳回</option>
        </select>
        <select name="saleStatus" defaultValue={saleStatus || ""} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}>
          <option value="">全部销售状态</option>
          <option value="ON_SALE">上架中</option>
          <option value="OFF_SHELF">已下架</option>
        </select>
        <button type="submit" style={{ padding: "6px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>筛选</button>
        {(status || saleStatus || search) ? (
          <Link href="/merchant/products" style={{ padding: "6px 14px", background: "#f3f4f6", color: "#333", borderRadius: 4, textDecoration: "none", fontSize: 13 }}>清除</Link>
        ) : null}
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>商品</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>类目</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>价格</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>库存</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>审核状态</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>销售状态</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const minPrice = p.skus.length > 0 ? Math.min(...p.skus.map((s) => s.price)) : 0;
            const totalStock = p.skus.reduce((sum, s) => sum + s.stock, 0);
            return (
              <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "12px 16px", fontSize: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img src={p.mainImage} alt={p.name} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{p.category?.name || "-"}</td>
                <td style={{ padding: "12px 16px", fontSize: 14 }}>
                  {minPrice > 0 ? `¥${(minPrice / 100).toFixed(2)}` : "-"}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 14 }}>{totalStock}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, color: "#fff", background: statusColors[p.status] || "#999" }}>
                    {statusLabels[p.status] || p.status}
                  </span>
                  {p.status === "REJECTED" && p.rejectReason && (
                    <div style={{ fontSize: 11, color: "#c00", marginTop: 4 }}>原因：{p.rejectReason}</div>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, color: "#fff", background: p.saleStatus === "ON_SALE" ? "#10b981" : "#6b7280" }}>
                    {p.saleStatus === "ON_SALE" ? "上架中" : "已下架"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {p.status !== "PENDING" && (
                      <Link href={`/merchant/products/${p.id}/edit`} style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}>编辑</Link>
                    )}
                    {p.status === "APPROVED" && (
                      <form action={toggleProductSaleStatusAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="saleStatus" value={p.saleStatus === "ON_SALE" ? "OFF_SHELF" : "ON_SALE"} />
                        <button type="submit" style={{ fontSize: 12, background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0 }}>
                          {p.saleStatus === "ON_SALE" ? "下架" : "上架"}
                        </button>
                      </form>
                    )}
                    {p.status === "DRAFT" && (
                      <form action={deleteProductAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" style={{ fontSize: 12, background: "none", border: "none", color: "#c00", cursor: "pointer", padding: 0 }}>删除</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无商品</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
