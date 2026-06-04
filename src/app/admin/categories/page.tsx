import { findTree } from "@/server/services/category.service";
import { createCategoryAction, toggleCategoryStatusAction } from "@/server/actions/admin.category.actions";
import { CategoryStatus } from "@prisma/client";

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  status: CategoryStatus;
  icon: string | null;
  children: CategoryNode[];
}

export default async function AdminCategoriesPage() {
  const categories = await findTree() as unknown as CategoryNode[];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>类目管理</h1>

      <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 24, border: "1px solid #e5e7eb" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>新增类目</h3>
        <form action={createCategoryAction} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>名称 *</label>
            <input name="name" required style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>父类目</label>
            <select name="parentId" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 120 }}>
              <option value="">一级类目</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>排序</label>
            <input name="sortOrder" type="number" defaultValue="0" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", width: 80 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>图标URL</label>
            <input name="icon" style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200 }} />
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
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>排序</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>状态</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => renderCategoryRow(cat, 0))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无类目</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCategoryRow(cat: CategoryNode, depth: number): React.ReactNode {
  return (
    <>
      <tr key={cat.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
        <td style={{ padding: "10px 16px", fontSize: 14, paddingLeft: `${16 + depth * 24}px` }}>
          {depth > 0 && <span style={{ color: "#ccc", marginRight: 4 }}>└</span>}
          {cat.name}
        </td>
        <td style={{ padding: "10px 16px", fontSize: 14, color: "#666" }}>{cat.sortOrder}</td>
        <td style={{ padding: "10px 16px" }}>
          <span style={{
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 12,
            color: "#fff",
            background: cat.status === CategoryStatus.ACTIVE ? "#10b981" : "#6b7280"
          }}>
            {cat.status === CategoryStatus.ACTIVE ? "启用" : "禁用"}
          </span>
        </td>
        <td style={{ padding: "10px 16px" }}>
          <form action={toggleCategoryStatusAction} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={cat.id} />
            <button type="submit" style={{ fontSize: 12, padding: "4px 10px", borderRadius: 4, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
              {cat.status === CategoryStatus.ACTIVE ? "禁用" : "启用"}
            </button>
          </form>
        </td>
      </tr>
      {cat.children?.map((child) => renderCategoryRow(child, depth + 1))}
    </>
  );
}
