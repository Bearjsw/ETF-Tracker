type Props = {
  trackedStocks: number;
  hasSellEvents: boolean;
  krxConfigured?: boolean;
};

/** 샘플·미수집 상태로 볼 만큼 적은 종목 수 */
const LOW_COVERAGE_STOCKS = 30;

export function FlowDataNotice({ trackedStocks, hasSellEvents, krxConfigured = false }: Props) {
  if (trackedStocks === 0) {
    return (
      <div className="rounded-xl border border-[#e8ebe6] bg-[#f7f8f5] px-4 py-3 text-sm text-[var(--muted)]">
        ETF 비중 변화 데이터가 없습니다.{" "}
        <code className="code-inline">python scripts/run_pipeline.py --collect</code> 실행 후 순위가
        표시됩니다.
      </div>
    );
  }

  if (trackedStocks < LOW_COVERAGE_STOCKS) {
    return (
      <div className="rounded-xl border border-[#e8ebe6] bg-[#f7f8f5] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">데이터 범위 안내</span>
        {" · "}
        현재 <strong className="font-semibold text-[var(--foreground)]">{trackedStocks}개 종목</strong>만
        비중 변화로 추적 중입니다 (샘플 데이터 또는 수집 직후). 순위는 ETF 편입·비중 조정에서 추정한 흐름이며, KRX
        시장 전체 거래 순위가 아닙니다.
        {krxConfigured ? (
          <>
            {" "}
            전체 수집이 필요하면{" "}
            <code className="code-inline">python scripts/run_pipeline.py --collect --limit 600</code>를
            실행하세요.
          </>
        ) : (
          <>
            {" "}
            <code className="code-inline">KRX_ID</code>/<code className="code-inline">KRX_PW</code> 설정 후{" "}
            <code className="code-inline">collect_daily.py</code>로 실보유를 수집하면 더 많은 종목이 쌓입니다.
          </>
        )}
      </div>
    );
  }

  if (!hasSellEvents) {
    return (
      <div className="rounded-xl border border-[#e8ebe6] bg-[#f7f8f5] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">데이터 범위 안내</span>
        {" · "}
        ETF 보유 비중 변화 기준 · 추적 종목{" "}
        <strong className="font-semibold text-[var(--foreground)]">{trackedStocks.toLocaleString("ko-KR")}개</strong>{" "}
        (KRX 시장 전체 거래 순위 아님). 연속 2일 이상 수집·diff 계산 후 순매도·비중 축소가 반영됩니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e8ebe6] bg-[#f7f8f5] px-4 py-3 text-sm text-[var(--muted)]">
      ETF 보유 비중 변화 기준 · 추적 종목 {trackedStocks.toLocaleString("ko-KR")}개 (KRX 시장 전체 거래 순위 아님)
    </div>
  );
}
