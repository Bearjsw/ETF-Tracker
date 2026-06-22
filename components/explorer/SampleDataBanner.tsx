export function SampleDataBanner() {
  return (
    <div className="banner-info">
      샘플 보유 데이터가 표시 중입니다. 실시간 수집을 위해{" "}
      <code className="code-inline">.env.local</code>에 <code className="code-inline">KRX_ID</code>,{" "}
      <code className="code-inline">KRX_PW</code>를 추가한 뒤{" "}
      <code className="code-inline">python scripts/run_pipeline.py --collect</code>을 실행하세요.
    </div>
  );
}
