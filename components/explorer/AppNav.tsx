import Link from "next/link";

const links = [
  { href: "/etfs", label: "ETF Explorer" },
  { href: "/signals", label: "Signals" },
];

export function AppNav() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          ETF-Tracker <span className="text-[var(--muted)]">수렴진화</span>
        </Link>
        <nav className="flex gap-4 text-sm text-[var(--muted)]">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
