export function DemoModeBanner() {
  return (
    <div className="banner-warn">
      데모 모드 — Postgres가 연결되지 않아 샘플 데이터를 표시합니다.{" "}
      <code className="code-inline">POSTGRES_URL</code>을 설정하면 실제 ETF 목록을 사용할 수 있습니다.
    </div>
  );
}
