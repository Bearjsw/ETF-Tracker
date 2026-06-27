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

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.64h.05c.53-1 1.83-2.05 3.77-2.05C20.6 8.59 22 10.27 22 13.4V21h-4v-6.74c0-1.61-.03-3.68-2.24-3.68-2.24 0-2.58 1.75-2.58 3.56V21H9V9Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SidebarCredit() {
  return (
    <div className="sidebar-credit">
      <p className="sidebar-credit__sources">데이터 출처: 한국거래소(KRX) · Yahoo Finance</p>
      <div className="sidebar-credit__maker">
        <span className="sidebar-credit__by">Made by</span>
        <span className="sidebar-credit__name">Sungwon Jeon</span>
        <div className="sidebar-credit__links">
          <a
            href="https://www.linkedin.com/in/sungwon-jeon0125/"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-credit__icon"
            aria-label="LinkedIn"
          >
            <LinkedInIcon />
          </a>
          <a
            href="mailto:sw25jeon@gmail.com"
            className="sidebar-credit__icon"
            aria-label="이메일 sw25jeon@gmail.com"
          >
            <MailIcon />
          </a>
        </div>
      </div>
    </div>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ETF Tracker" className="sidebar-logo sidebar-logo--img" width={36} height={36} />
          <span className="sidebar-title">ETF Tracker</span>
        </Link>
      </header>

      <aside className="app-sidebar app-sidebar--desktop">
        <Link href="/" className="sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ETF Tracker" className="sidebar-logo sidebar-logo--img" width={36} height={36} />
          <span className="sidebar-title">ETF Tracker</span>
        </Link>

        <nav className="sidebar-nav">
          <NavGroups pathname={pathname} />
        </nav>

        <SidebarCredit />
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="ETF Tracker" className="sidebar-logo sidebar-logo--img" width={36} height={36} />
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

          <SidebarCredit />
        </aside>
      </div>
    </>
  );
}
