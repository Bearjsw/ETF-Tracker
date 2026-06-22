import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card max-w-lg">
      <h1 className="section-title">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">주소가 바뀌었거나 삭제된 페이지일 수 있습니다.</p>
      <Link href="/" className="btn-primary mt-4 inline-block text-sm">
        홈으로
      </Link>
    </div>
  );
}
