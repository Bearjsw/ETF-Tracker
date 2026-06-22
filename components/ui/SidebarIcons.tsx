import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function HomeIcon({ className, ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M4.5 10.5 12 4.5 19.5 10.5" />
      <path d="M6.5 10.5V19h4.5v-5.5h2v5.5H18v-8.5" />
    </svg>
  );
}

/** 시그널 피드 — 펄스 막대 */
export function SignalFeedIcon({ className, ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M5 16V11" />
      <path d="M9.5 16V8" />
      <path d="M14 16V6" />
      <path d="M18.5 16v-5" />
    </svg>
  );
}

/** 시장 — 막대 차트 */
export function MarketIcon({ className, ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 17V11" />
      <path d="M12 17V8" />
      <path d="M16 17v-4" />
    </svg>
  );
}

/** 흐름 — 양방향 화살표 */
export function FlowIcon({ className, ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M7 9h10" />
      <path d="M7 9l3-3" />
      <path d="M7 9l3 3" />
      <path d="M17 15H7" />
      <path d="M17 15l-3-3" />
      <path d="M17 15l-3 3" />
    </svg>
  );
}

/** ETF — 포트폴리오 그리드 */
export function EtfIcon({ className, ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5v17" />
    </svg>
  );
}

/** 종목 — 추세선 */
export function StockIcon({ className, ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M4 17l5.5-5.5 4 3L20 7" />
      <path d="M16 7h4v4" />
    </svg>
  );
}

export type SidebarIconComponent = (props: IconProps) => ReactElement;
