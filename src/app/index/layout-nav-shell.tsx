"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";

export function LayoutNavShell({
  user,
  children
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/index/login") return <>{children}</>;

  return (
    <>
      <header style={{ borderBottom: "1px solid #e0e0e0", padding: "8px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
        <Link href="/index" style={{ fontWeight: 700, fontSize: 18, textDecoration: "none", color: "#111" }}>1Shop</Link>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {user ? (
            <span style={{ fontSize: 13, color: "#666" }}>{user.email ?? user.phone ?? user.userId}</span>
          ) : (
            <Link href="/index/login" style={{ fontSize: 14, textDecoration: "none", color: "#333" }}>登录</Link>
          )}
        </nav>
      </header>
      {children}
    </>
  );
}
