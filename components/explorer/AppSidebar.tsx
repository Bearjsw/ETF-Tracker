"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  EtfIcon,
  FlowIcon,
  HomeIcon,
  MarketIcon,
  SignalFeedIcon,
  StockIcon,
  type SidebarIconComponent,
} from "@/components/ui/SidebarIcons";

type NavLink = { href: string; label: string; icon?: SidebarIconComponent };
type NavGroup = { title?: string; links: NavLink[] };

const navGroups: NavGroup[] = [
  {
    links: [
      { href: "/", label: "홈", icon: HomeIcon },
      { href: "/market", label: "시장", icon: MarketIcon },
      { href: "/flows", label: "흐름", icon: FlowIcon },
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

function NavGroups({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
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
                onClick={onNavigate}
                className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
              >
                {Icon ? (
                  <span className="sidebar-link-icon">
                    <Icon />
                  </span>
                ) : null}
                <span className="sidebar-link-text">
                  <span>{link.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="mobile-nav-header">
        <button
          type="button"
          className="mobile-nav-menu-btn"
          aria-label="메뉴 열기"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon />
        </button>
        <Link href="/" className="mobile-nav-brand">
          <span className="sidebar-logo">E</span>
          <span className="sidebar-title">ETF Tracker</span>
        </Link>
      </header>

      <aside className="app-sidebar app-sidebar--desktop">
        <Link href="/" className="sidebar-brand">
          <span className="sidebar-logo">E</span>
          <span className="sidebar-title">ETF Tracker</span>
        </Link>

        <nav className="sidebar-nav">
          <NavGroups pathname={pathname} />
        </nav>
      </aside>

      <div
        className={`mobile-nav-drawer ${menuOpen ? "mobile-nav-drawer--open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="메뉴 닫기"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />
        <aside className="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="메뉴">
          <div className="mobile-nav-panel__head">
            <Link href="/" className="sidebar-brand" onClick={() => setMenuOpen(false)}>
              <span className="sidebar-logo">E</span>
              <span className="sidebar-title">ETF Tracker</span>
            </Link>
            <button
              type="button"
              className="mobile-nav-menu-btn"
              aria-label="메뉴 닫기"
              onClick={() => setMenuOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="sidebar-nav mobile-nav-panel__nav">
            <NavGroups pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </nav>
        </aside>
      </div>
    </>
  );
}
