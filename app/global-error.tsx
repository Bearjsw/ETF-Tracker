"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#f5f5f0] p-6 antialiased">
        <div
          style={{
            maxWidth: "28rem",
            margin: "4rem auto",
            padding: "1.25rem 1.5rem",
            borderRadius: "10px",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>오류가 발생했습니다</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b7280", lineHeight: 1.5 }}>
            {error.message || "앱을 다시 시작해 주세요."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              borderRadius: "8px",
              background: "#3d7a2e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
