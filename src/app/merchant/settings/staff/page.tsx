import { findStaffsAction, removeStaffAction } from "@/server/actions/merchant.staff.actions";
import AddStaffForm from "./_components/add-staff-form";

export default async function StaffManagementPage() {
  let staffs: Awaited<ReturnType<typeof findStaffsAction>> = [];
  let error: string | null = null;

  try {
    staffs = await findStaffsAction();
  } catch {
    error = "加载员工列表失败";
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>员工管理</h1>

      <AddStaffForm />

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 12px", background: "#fff0f0", color: "#c00", borderRadius: 4, fontSize: 13 }}>
          {error}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>姓名</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>手机号</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>邮箱</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>角色</th>
            <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e7eb" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {staffs.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{s.user.displayName || "-"}</td>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{s.user.phone || "-"}</td>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{s.user.email || "-"}</td>
              <td style={{ padding: "12px 16px" }}>
                <span
                  style={{
                    fontSize: 12,
                    padding: "2px 8px",
                    borderRadius: 12,
                    color: "#fff",
                    background: s.isOwner ? "#2563eb" : "#6b7280"
                  }}
                >
                  {s.isOwner ? "店主" : "员工"}
                </span>
              </td>
              <td style={{ padding: "12px 16px" }}>
                {!s.isOwner && (
                  <form action={removeStaffAction} style={{ display: "inline" }}>
                    <input type="hidden" name="staffId" value={s.id} />
                    <button
                      type="submit"
                      style={{
                        fontSize: 12,
                        background: "none",
                        border: "none",
                        color: "#c00",
                        cursor: "pointer",
                        padding: 0
                      }}
                    >
                      删除
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {staffs.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无员工</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
