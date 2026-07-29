import { findBuyerProducts } from "@/server/services/product.service";
import { findActiveTree } from "@/server/services/category.service";
import Link from "next/link";

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ categoryId?: string; search?: string }>;
}) {
  const params = await searchParams;
  const categoryId = params.categoryId;
  const search = params.search;

  const [{ items: products, total }, categories] = await Promise.all([
    findBuyerProducts({ categoryId, search }),
    findActiveTree()
  ]);

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", display: "flex", gap: 24 }}>
      <aside style={{ width: 200, flexShrink: 0 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>类目</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Link href="/products" style={{ fontSize: 13, padding: "6px 8px", borderRadius: 4, textDecoration: "none", color: !categoryId ? "#fff" : "#333", background: !categoryId ? "#111" : "transparent" }}>全部</Link>
          {categories.map((cat) => (
            <div key={cat.id}>
              <Link href={`/products?categoryId=${cat.id}`} style={{ fontSize: 13, padding: "6px 8px", borderRadius: 4, textDecoration: "none", color: categoryId === cat.id ? "#fff" : "#333", background: categoryId === cat.id ? "#111" : "transparent", display: "block" }}>{cat.name}</Link>
              {(cat as unknown as { children: { id: string; name: string }[] }).children?.map((child) => (
                <Link key={child.id} href={`/products?categoryId=${child.id}`} style={{ fontSize: 12, padding: "4px 8px 4px 20px", borderRadius: 4, textDecoration: "none", color: categoryId === child.id ? "#fff" : "#666", background: categoryId === child.id ? "#111" : "transparent", display: "block" }}>{child.name}</Link>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
          <form style={{ display: "flex", gap: 8, flex: 1 }}>
            <input name="search" defaultValue={search || ""} placeholder="搜索商品" style={{ flex: 1, padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc" }} />
            {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
            <button type="submit" style={{ padding: "8px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>搜索</button>
          </form>
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>共 {total} 件商品</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {products.map((p) => {
            const minPrice = (p as unknown as { skus: { price: number }[] }).skus[0]?.price ?? 0;
            const merchantName = (p as unknown as { merchant?: { name: string } }).merchant?.name ?? "";
            return (
              <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                  {p.mainImage ? (
                    <img src={p.mainImage} alt={p.name} style={{ width: "100%", height: 200, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: 200, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>暂无图片</div>
                  )}
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, lineHeight: 1.4, height: 40, overflow: "hidden" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>{merchantName}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>¥{(minPrice / 100).toFixed(2)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
