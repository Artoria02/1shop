import { getSessionUser } from "@/lib/auth";
import { LayoutNavShell } from "@/components/layout-nav-shell";

export default async function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser("BUYER");
  return <LayoutNavShell user={user}>{children}</LayoutNavShell>;
}
