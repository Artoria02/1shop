"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const tabs = [
  { href: "/merchant/settings/info", label: "基础信息" },
  { href: "/merchant/settings/payment", label: "资金与支付" },
  { href: "/merchant/settings/shipping", label: "物流与运费" },
  { href: "/merchant/settings/account", label: "账号与安全" },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "block",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? "#111" : "#666",
              borderBottom: active ? "2px solid #111" : "2px solid transparent",
              textDecoration: "none",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
