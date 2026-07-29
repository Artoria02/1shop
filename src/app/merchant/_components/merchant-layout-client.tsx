"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { logoutAction } from "@/server/actions/auth.actions";
import type { SessionUser } from "@/lib/types";
import type { Merchant } from "@prisma/client";

interface Props {
  user: SessionUser;
  merchant: Merchant | null;
  email: string;
  children: React.ReactNode;
}

export default function MerchantLayoutClient({ user, merchant, email, children }: Props) {
  const pathname = usePathname();

  if (pathname === "/merchant/login" || pathname === "/merchant/apply") {
    return <>{children}</>;
  }

  if (merchant && (merchant.status === "DISABLED" || merchant.status === "REJECTED")) {
    const isDisabled = merchant.status === "DISABLED";
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: 48, borderBottom: "1px solid #e0e0e0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>1Shop - 商家后台</span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#333" }}>{user.displayName ?? email}</span>
              </div>
            <form action={logoutAction}>
              <input type="hidden" name="redirectTo" value="/merchant/login" />
              <button type="submit" style={{ fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 10px", cursor: "pointer", color: "#666" }}>退出</button>
            </form>
          </div>
        </header>
        <main style={{ flex: 1, padding: 40, background: "#f6f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 480, width: "100%", textAlign: "center", background: "#fff", padding: 40, borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
              {isDisabled ? "店铺已被平台禁用" : "店铺入驻申请已被驳回"}
            </h2>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
              {isDisabled
                ? "您的店铺因违规或其他原因已被平台禁用，无法继续经营。您可以重新提交入驻申请。"
                : "您的店铺入驻申请未通过平台审核。您可以修改资料后重新提交申请。"}
            </p>
            {merchant.rejectionReason && (
              <div style={{ background: "#fff0f0", padding: 12, borderRadius: 4, marginBottom: 24, textAlign: "left" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>原因</div>
                <div style={{ fontSize: 14, color: "#c00" }}>{merchant.rejectionReason}</div>
              </div>
            )}
            <Link
              href="/merchant/apply"
              style={{ display: "inline-block", padding: "10px 24px", background: "#111", color: "#fff", borderRadius: 4, textDecoration: "none", fontSize: 14 }}
            >
              重新申请入驻
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (merchant && merchant.status === "PENDING") {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: 48, borderBottom: "1px solid #e0e0e0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>1Shop - 商家后台</span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#333" }}>{user.displayName ?? email}</span>
              </div>
            <form action={logoutAction}>
              <input type="hidden" name="redirectTo" value="/merchant/login" />
              <button type="submit" style={{ fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 10px", cursor: "pointer", color: "#666" }}>退出</button>
            </form>
          </div>
        </header>
        <main style={{ flex: 1, padding: 40, background: "#f6f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 480, width: "100%", textAlign: "center", background: "#fff", padding: 40, borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>入驻申请审核中</h2>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
              您的商家入驻申请已提交，平台正在审核中。审核通过后即可使用商家后台全部功能。
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ height: 48, borderBottom: "1px solid #e0e0e0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>1Shop - 商家后台</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#333" }}>{user.displayName ?? email}</span>
              </div>
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
            <NavLink href="/merchant/settings" label="店铺设置" />
          </nav>
        </aside>
        <main style={{ flex: 1, padding: 24, background: "#f6f5f2" }}>{children}</main>
      </div>
    </div>
  );
}
