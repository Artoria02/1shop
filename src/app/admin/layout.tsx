import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/db";
import { logoutAction } from "@/server/actions/auth.actions";
import { NavLink } from "@/components/nav-link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const path = h.get("x-pathname") || "";

  if (path === "/admin/login") return <>{children}</>;

  const user = await getSessionUser();
  if (!user || user.end !== "PLATFORM_ADMIN") redirect("/admin/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true }
  });
  const email = dbUser?.email ?? "Admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ height: 48, borderBottom: "1px solid #e0e0e0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>1Shop - 平台管理</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#666" }}>{email}</span>
          <form action={logoutAction}>
            <input type="hidden" name="redirectTo" value="/admin/login" />
            <button type="submit" style={{ fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 10px", cursor: "pointer", color: "#666" }}>退出</button>
          </form>
        </div>
      </header>
      <div style={{ display: "flex", flex: 1 }}>
        <aside style={{ width: 220, background: "#f8f9fa", padding: "16px 12px", borderRight: "1px solid #e0e0e0", flexShrink: 0 }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <NavLink href="/admin" label="概览" />
            <NavLink href="/admin/merchants" label="商家审核" />
            <NavLink href="/admin/products" label="商品审核" />
            <NavLink href="/admin/orders" label="订单管理" />
            <NavLink href="/admin/commissions" label="佣金配置" />
            <NavLink href="/admin/settlements" label="结算管理" />
            <NavLink href="/admin/reports" label="报表" />
          </nav>
        </aside>
        <main style={{ flex: 1, padding: 24, background: "#f6f5f2" }}>{children}</main>
      </div>
    </div>
  );
}
