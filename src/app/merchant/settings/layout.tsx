import SettingsNav from "./_components/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>店铺设置</h1>
      <SettingsNav />
      {children}
    </div>
  );
}
