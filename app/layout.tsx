import type { Metadata } from "next";
import { AppNav } from "@/components/explorer/AppNav";
import { DemoModeBanner } from "@/components/explorer/DemoModeBanner";
import { isDatabaseConfigured } from "@/lib/db/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETF-Tracker | 수렴진화",
  description: "국내 ETF 보유 변화 Explorer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = !isDatabaseConfigured();

  return (
    <html lang="ko">
      <body>
        {demoMode ? <DemoModeBanner /> : null}
        <AppNav />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
