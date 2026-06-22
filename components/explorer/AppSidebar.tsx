"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EtfIcon,
  FlowIcon,
  HomeIcon,
  MarketIcon,
  SignalFeedIcon,
  StockIcon,
  type SidebarIconComponent,
} from "@/components/ui/SidebarIcons";

type NavLink = { href: string; label: string; icon?: SidebarIconComponent; subtitle?: string };
type NavGroup = { title?: string; links: NavLink[] };

const navGroups: NavGroup[] = [
  {
    links: [
      { href: "/", label: "홈", icon: HomeIcon, subtitle: "요약" },
      { href: "/market", label: "시장", icon: MarketIcon, subtitle: "규모·자금흐름" },
      { href: "/flows", label: "흐름", icon: FlowIcon, subtitle: "look-through" },
      { href: "/signals", label: "시그널", icon: SignalFeedIcon },
    ],
  },
  {
    title: "탐색",
    links: [
      { href: "/etfs?strategy=active", label: "ETF", icon: EtfIcon },
      { href: "/stocks", label: "종목", icon: StockIcon },
    ],
  },
];

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/etfs")) return pathname === "/etfs" || pathname.startsWith("/etfs/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <Link href="/" className="sidebar-brand">
        <span className="sidebar-logo">E</span>
        <span className="sidebar-title">ETF Tracker</span>
      </Link>

      <nav className="sidebar-nav">
        {navGroups.map((group, gi) => (
          <div key={gi} className="sidebar-group">
            {group.title ? <p className="sidebar-group-title">{group.title}</p> : null}
            {group.links.map((link) => {
              const active = isLinkActive(pathname, link.href);
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                >
                  {Icon ? (
                    <span className="sidebar-link-icon">
                      <Icon />
                    </span>
                  ) : null}
                  <span className="sidebar-link-text">
                    <span>{link.label}</span>
                    {link.subtitle ? (
                      <span className="sidebar-link-sub">{link.subtitle}</span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="text-xs text-[var(--muted)]">액티브 ETF 비중 추적</p>
        <a
          href="https://kaph-etf-scope.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-[10px] text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ETFScope ↗
        </a>
      </div>
    </aside>
  );
}
