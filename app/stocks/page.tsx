import { PopularStocksTable } from "@/components/explorer/PopularStocksTable";
import { StocksExplorer } from "@/components/explorer/StocksExplorer";
import { PageHeader } from "@/components/explorer/PageHeader";
import { fetchPopularStocks } from "@/lib/db/queries";
import { Suspense } from "react";

export default async function StocksPage() {
  const stocks = await fetchPopularStocks(800);

  return (
    <div className="space-y-8">
      <PageHeader
        title="종목"
        description="여러 액티브 ETF가 동시에 담은 종목을 추적합니다. 국내·해외, 주식·채권 등으로 나눠 볼 수 있습니다. 종목을 클릭하면 어떤 ETF가 얼마나 비중을 늘렸는지, 변화 이후 수익률은 어땠는지 확인할 수 있습니다."
      />
      <Suspense fallback={<PopularStocksTable stocks={stocks} />}>
        <StocksExplorer stocks={stocks} />
      </Suspense>
    </div>
  );
}
