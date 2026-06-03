"use client";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <a
      href={href}
      style={{
        display: "block",
        padding: "8px 12px",
        borderRadius: 4,
        textDecoration: "none",
        fontSize: 14,
        color: active ? "#fff" : "#333",
        background: active ? "#111" : "transparent",
        fontWeight: active ? 600 : 400
      }}
    >
      {label}
    </a>
  );
}