import { findBuyerProducts } from "@/server/services/product.service";
import Link from "next/link";

export default async function HomePage() {
  const { items: products } = await findBuyerProducts({ pageSize: 12 });

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>1Shop 电商平台</h1>
        <Link href="/products" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>查看全部 →</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {products.map((p) => {
          const minPrice = (p as unknown as { skus: { price: number }[] }).skus[0]?.price ?? 0;
          const merchantName = (p as unknown as { merchant?: { name: string } }).merchant?.name ?? "";
          return (
            <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", transition: "box-shadow 0.2s" }}>
                <img src={p.mainImage} alt={p.name} style={{ width: "100%", height: 200, objectFit: "cover" }} />
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
  );
}
