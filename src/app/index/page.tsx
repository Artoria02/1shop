export default function HomePage() {
  return (
    <div style={{ padding: "40px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>1Shop 电商平台</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>多商家电商平台 — 浏览商品、下单购买、享受便捷购物体验</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {[
          { title: "热门商品", desc: "浏览平台精选热门商品" },
          { title: "新品上架", desc: "发现最新上架的商品" },
          { title: "限时优惠", desc: "查看限时折扣和优惠活动" }
        ].map((card) => (
          <div key={card.title} style={{ padding: 24, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>{card.title}</h3>
            <p style={{ fontSize: 14, color: "#666" }}>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}