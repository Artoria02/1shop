import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "1Shop",
  description: "多商家电商平台"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}