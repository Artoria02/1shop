import { findById } from "@/server/services/product.service";
import { reviewProductAction } from "@/server/actions/admin.product.actions";
import { NotFoundError } from "@/lib/errors";
import Link from "next/link";
import { ProductStatus } from "@prisma/client";

const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回"
};

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let product;
  try {
    product = await findById(id);
  } catch (e) {
    if (e instanceof NotFoundError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#999" }}>商品不存在</p>
          <Link href="/admin/products" style={{ color: "#2563eb", fontSize: 14 }}>返回列表</Link>
        </div>
      );
    }
    throw e;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/products" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>← 返回列表</Link>
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{product.name}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>基本信息</h3>
          <Row label="商品名称" value={product.name} />
          <Row label="副标题" value={product.subtitle || "-"} />
          <Row label="类目" value={(product as unknown as { category?: { name: string } }).category?.name || "-"} />
          <Row label="品牌" value={(product as unknown as { brand?: { name: string } }).brand?.name || "-"} />
          <Row label="商家" value={(product as unknown as { merchant?: { name: string } }).merchant?.name || "-"} />
          <Row label="审核状态" value={statusLabels[product.status] || product.status} />
          {product.rejectReason && <Row label="驳回原因" value={product.rejectReason} />}
          <Row label="描述" value={product.description || "-"} />
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>商品图片</h3>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>主图</div>
          <img src={product.mainImage} alt="主图" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 4, marginBottom: 12 }} />
          {product.images.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>详情图</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.images.map((img, i) => (
                  <img key={i} src={img} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 4 }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>SKU 明细</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>SKU编码</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>规格</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>售价</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>划线价</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>库存</th>
            </tr>
          </thead>
          <tbody>
            {product.skus.map((sku) => (
              <tr key={sku.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 10px" }}>{sku.skuCode}</td>
                <td style={{ padding: "8px 10px" }}>{Object.entries(sku.specs as Record<string, string>).map(([k, v]) => `${k}:${v}`).join(" / ")}</td>
                <td style={{ padding: "8px 10px" }}>¥{(sku.price / 100).toFixed(2)}</td>
                <td style={{ padding: "8px 10px" }}>{sku.originalPrice ? `¥${(sku.originalPrice / 100).toFixed(2)}` : "-"}</td>
                <td style={{ padding: "8px 10px" }}>{sku.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {product.status === ProductStatus.PENDING && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>审核操作</h3>
          <form action={reviewProductAction} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <input type="hidden" name="id" value={product.id} />
            <div>
              <select name="status" required style={{ padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 120 }}>
                <option value="">选择操作</option>
                <option value="APPROVED">通过</option>
                <option value="REJECTED">驳回</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <input name="reason" placeholder="驳回原因（可选）" style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc" }} />
            </div>
            <button type="submit" style={{ padding: "8px 20px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>提交</button>
          </form>
        </div>
      )}
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
