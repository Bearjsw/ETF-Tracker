import type { Metadata } from "next";
import { AppSidebar } from "@/components/explorer/AppSidebar";
import { DemoModeBanner } from "@/components/explorer/DemoModeBanner";
import { SampleDataBanner } from "@/components/explorer/SampleDataBanner";
import { shouldShowSampleBanner } from "@/lib/db/data-status";
import { isDatabaseConfigured } from "@/lib/db/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETF Tracker | 액티브 ETF 비중 변화",
  description: "액티브 ETF 보유 비중 변화와 변화 후 수익률을 추적합니다",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = !isDatabaseConfigured();
  const sampleBanner = !demoMode && (await shouldShowSampleBanner());

  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-screen antialiased">
        {demoMode ? <DemoModeBanner /> : null}
        {sampleBanner ? <SampleDataBanner /> : null}
        <div className="app-shell">
          <AppSidebar />
          <div className="app-main-wrap">
            <div className="app-main">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
