export function DemoModeBanner() {
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
      데모 모드 — Postgres가 연결되지 않아 샘플 데이터를 표시합니다. Vercel Storage에서 Postgres를 생성하고{" "}
      <code className="rounded bg-black/30 px-1.5 py-0.5">POSTGRES_URL</code>을 설정하세요.
    </div>
  );
}
