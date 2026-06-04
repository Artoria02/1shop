import { findMany } from "@/server/services/brand.service";
import { createBrandAction, toggleBrandStatusAction } from "@/server/actions/admin.brand.actions";
import { CategoryStatus } from "@prisma/client";

export default async function AdminBrandsPage() {
  const brands = await findMany();

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>品牌管理</h1>

      <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 24, border: "1px solid #e5e7eb" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>新增品牌</h3>
        <form action={createBrandAction} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>名称 *</label>
            <input name="name" required style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Logo URL</label>
            <input name="logo" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>描述</label>
            <input name="description" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 240 }} />
          </div>
          <button type="submit" style={{ padding: "6px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            新增
          </button>
        </form>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>名称</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>描述</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>状态</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 16px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  {b.logo && <img src={b.logo} alt={b.name} style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4 }} />}
                  {b.name}
                </td>
                <td style={{ padding: "10px 16px", fontSize: 14, color: "#666" }}>{b.description || "-"}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{
                    fontSize: 12,
                    padding: "2px 8px",
                    borderRadius: 12,
                    color: "#fff",
                    background: b.status === CategoryStatus.ACTIVE ? "#10b981" : "#6b7280"
                  }}>
                    {b.status === CategoryStatus.ACTIVE ? "启用" : "禁用"}
                  </span>
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <form action={toggleBrandStatusAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" style={{ fontSize: 12, padding: "4px 10px", borderRadius: 4, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
                      {b.status === CategoryStatus.ACTIVE ? "禁用" : "启用"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无品牌</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
