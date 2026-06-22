export function FilterIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 5h16l-6.2 7.25v5.5L10.2 19v-6.75L4 5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="filter-section">
      <p className="filter-section-label">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function FilterButtonGroup<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="filter-btn-row" role="radiogroup" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value || "__default"}
            type="button"
            role="radio"
            aria-checked={active}
            className={`filter-btn ${active ? "filter-btn-active" : ""}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
