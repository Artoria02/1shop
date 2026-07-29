"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";

function UserPersonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#333">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

const NO_NAV_PATHS = ["/index/login", "/index/register"];

export function LayoutNavShell({
  user,
  children
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (NO_NAV_PATHS.includes(pathname)) return <>{children}</>;

  return (
    <>
      <header style={{ borderBottom: "1px solid #e0e0e0", padding: "8px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
        <Link href="/index" style={{ fontWeight: 700, fontSize: 18, textDecoration: "none", color: "#111" }}>1Shop</Link>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {user && (
            <>
              <Link href="/orders" style={{ fontSize: 14, textDecoration: "none", color: "#333" }}>我的订单</Link>
              <Link href="/cart" style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none", position: "relative" }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 13, color: "#333" }}>购物车</span>
            </Link>
            </>
          )}
          {user ? (
            <Link href="/index/user" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: "#e8e8e8",
                display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"
              }}>
                {user.avatar ? (
                  <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <UserPersonIcon size={18} />
                )}
              </div>
              <span style={{ fontSize: 13, color: "#333" }}>{user.displayName ?? user.userId}</span>
            </Link>
          ) : (
            <Link href="/index/login" style={{ fontSize: 14, textDecoration: "none", color: "#333" }}>登录</Link>
          )}
        </nav>
      </header>
      {children}
    </>
  );
}
