import { getSessionUser } from "@/lib/auth";
import { LayoutNavShell } from "./layout-nav-shell";

export default async function IndexLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return <LayoutNavShell user={user}>{children}</LayoutNavShell>;
}
