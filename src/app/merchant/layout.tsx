import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { logoutAction } from "@/server/actions/auth.actions";
import { NavLink } from "@/components/nav-link";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const path = h.get("x-invoke-path") || "";

  if (path === "/merchant/login") return <>{children}</>;

  const user = await getSessionUser();
  if (!user || user.kind !== "MERCHANT_STAFF") redirect("/merchant/login");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ height: 48, borderBottom: "1px solid #e0e0e0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>1Shop - 商家后台</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#666" }}>{user.email}</span>
          <form action={logoutAction}>
            <input type="hidden" name="redirectTo" value="/merchant/login" />
            <button type="submit" style={{ fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 10px", cursor: "pointer", color: "#666" }}>退出</button>
          </form>
        </div>
      </header>
      <div style={{ display: "flex", flex: 1 }}>
        <aside style={{ width: 220, background: "#f8f9fa", padding: "16px 12px", borderRight: "1px solid #e0e0e0", flexShrink: 0 }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <NavLink href="/merchant" label="概览" />
            <NavLink href="/merchant/products" label="商品管理" />
            <NavLink href="/merchant/orders" label="订单管理" />
            <NavLink href="/merchant/marketing" label="营销" />
            <NavLink href="/merchant/settlement" label="结算" />
          </nav>
        </aside>
        <main style={{ flex: 1, padding: 24, background: "#f6f5f2" }}>{children}</main>
      </div>
    </div>
  );
}
