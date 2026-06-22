"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card max-w-lg">
      <h1 className="section-title">페이지를 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        일시적인 오류가 발생했습니다. 새로고침하거나 잠시 후 다시 시도해 주세요.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-sm" onClick={() => reset()}>
          다시 시도
        </button>
        <a href="/" className="btn-ghost text-sm">
          홈으로
        </a>
      </div>
    </div>
  );
}
