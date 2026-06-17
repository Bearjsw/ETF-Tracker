import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-3xl font-semibold">ETF-Tracker 수렴진화</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          국내 ETF의 일별 보유 변화를 추적하고, 운용사·ETF·종목 단위로 탐색합니다.
          pykrx 기반 수집 파이프라인과 Vercel Postgres 대시보드를 제공합니다.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/etfs" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
            ETF Explorer 열기
          </Link>
          <Link href="/signals" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
            Signals 보기
          </Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["운용사별 탐색", "/etfs", "어떤 운용사가 어떤 ETF를 운용하는지"],
          ["보유 변화", "/etfs", "신규편입·제외·비중 변화 타임라인"],
          ["종목 역추적", "/etfs", "특정 종목을 담은 ETF 목록"],
        ].map(([title, href, desc]) => (
          <Link key={title} href={href} className="card hover:border-[var(--accent)]">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
