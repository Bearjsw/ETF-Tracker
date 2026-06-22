"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "홈" },
  { href: "/market", label: "시장" },
  { href: "/flows", label: "흐름" },
  { href: "/signals", label: "시그널" },
  { href: "/etfs?strategy=active", label: "ETF" },
  { href: "/stocks", label: "종목" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-bright)] text-sm font-bold text-[var(--foreground)]">
            E
          </span>
          <span className="text-base font-semibold">ETF Tracker</span>
        </Link>
        <nav className="flex items-center gap-1 rounded-full bg-white/60 p-1 shadow-[var(--shadow-sm)]">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : link.href.startsWith("/etfs")
                  ? pathname === "/etfs" || pathname.startsWith("/etfs/")
                  : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[var(--accent-bright)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
