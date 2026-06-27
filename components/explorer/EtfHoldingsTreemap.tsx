"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, memo, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, Treemap } from "recharts";
import {
  formatTreemapDate,
  summarizeTreemapStats,
  TREEMAP_BUCKET_COLORS,
  TREEMAP_LEGEND_ORDER,
  treemapCellLayout,
  treemapLabelColor,
  type TreemapHolding,
} from "@/lib/holdings-treemap";
import { formatNumber, formatPercent } from "@/lib/utils";

type TreemapHover = {
  stock_name: string;
  stock_code: string;
  weight: number;
  returnPct: number | null;
  fill: string;
  x: number;
  y: number;
};

type TreemapHoverContextValue = {
  setHover: (hover: TreemapHover | null) => void;
};

const TreemapHoverContext = createContext<TreemapHoverContextValue | null>(null);

type CellProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  stock_code?: string;
  stock_name?: string | null;
  returnPct?: number | null;
  weight?: number;
  size?: number;
  fill?: string;
};

const CELL_GAP = 2;
const CELL_RADIUS = 4;

function TreemapCell(props: CellProps) {
  const router = useRouter();
  const hoverCtx = useContext(TreemapHoverContext);
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    depth,
    stock_name,
    stock_code,
    returnPct,
    weight,
    size,
    fill = "#e8ebe6",
  } = props;

  if ((depth ?? 1) === 0 || !stock_code) return <g />;

  const { innerX, innerY, innerW, innerH, radius } = treemapCellLayout(
    x,
    y,
    width,
    height,
    CELL_GAP,
    CELL_RADIUS,
  );
  const weightPct = weight ?? size ?? 0;

  const label = (stock_name ?? stock_code).trim();
  const maxChars =
    width >= 110 ? 11 : width >= 72 ? 8 : width >= 48 ? 5 : width >= 34 ? 3 : width >= 22 ? 2 : 0;
  const shortLabel =
    maxChars > 0 && label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
  const showName = maxChars > 0 && height >= 16 && innerW >= 14 && innerH >= 12;
  const showPct = showName && width >= 72 && height >= 32 && returnPct != null;
  const textColor = treemapLabelColor(fill);
  const nameSize = Math.max(8, Math.min(12, Math.round(Math.min(width, height) / 7)));
  const pctSize = Math.max(8, Math.min(10, Math.round(width / 12)));

  const go = () => router.push(`/stocks/${stock_code}`);

  const updateHover = (e: React.MouseEvent<SVGRectElement>) => {
    const wrap = e.currentTarget.closest(".holdings-treemap-wrap") as HTMLElement | null;
    if (!wrap || !hoverCtx) return;
    const rect = wrap.getBoundingClientRect();
    hoverCtx.setHover({
      stock_name: label,
      stock_code,
      weight: weightPct,
      returnPct: returnPct ?? null,
      fill,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const clearHover = () => hoverCtx?.setHover(null);

  const ariaLabel = [
    label,
    `비중 ${formatNumber(weightPct, 2)}%`,
    returnPct != null ? formatPercent(returnPct, 2, true) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <g className="holdings-treemap-cell-group">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        stroke="none"
        className="holdings-treemap-cell-hit"
        role="link"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={go}
        onMouseEnter={updateHover}
        onMouseMove={updateHover}
        onMouseLeave={clearHover}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        }}
      />
      <rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        rx={radius}
        ry={radius}
        fill={fill}
        stroke="none"
        pointerEvents="none"
        className="holdings-treemap-cell-fill"
      />
      {showName ? (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPct ? 6 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          stroke="none"
          strokeWidth={0}
          fontSize={nameSize}
          fontWeight={500}
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          pointerEvents="none"
          className="holdings-treemap-label"
        >
          {shortLabel}
        </text>
      ) : null}
      {showPct ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showName ? 9 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          stroke="none"
          strokeWidth={0}
          fontSize={pctSize}
          fontWeight={500}
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          pointerEvents="none"
          className="holdings-treemap-label holdings-treemap-label--pct"
        >
          {formatPercent(returnPct, 2, true)}
        </text>
      ) : null}
    </g>
  );
}

function TreemapHoverTooltip({ hover, tooltipRef }: { hover: TreemapHover; tooltipRef: React.RefObject<HTMLDivElement | null> }) {
  const returnUp = (hover.returnPct ?? 0) >= 0;

  return (
    <div
      ref={tooltipRef}
      className="holdings-treemap-tooltip"
      style={{ left: hover.x, top: hover.y }}
      role="tooltip"
    >
      <span className="holdings-treemap-tooltip__swatch" style={{ background: hover.fill }} aria-hidden />
      <div className="holdings-treemap-tooltip__body">
        <p className="holdings-treemap-tooltip__name">{hover.stock_name}</p>
        <div className="holdings-treemap-tooltip__row">
          <span className="holdings-treemap-tooltip__label">비중</span>
          <span className="holdings-treemap-tooltip__value">{formatNumber(hover.weight, 2)}%</span>
        </div>
        {hover.returnPct != null ? (
          <div className="holdings-treemap-tooltip__row">
            <span className="holdings-treemap-tooltip__label">1일</span>
            <span
              className={`holdings-treemap-tooltip__value font-semibold ${
                returnUp ? "delta-weight-up" : "delta-weight-down"
              }`}
            >
              {formatPercent(hover.returnPct, 2, true)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TreeData = {
  name: string;
  children: Array<TreemapHolding & { name: string; size: number }>;
};

const HoldingsTreemapChart = memo(function HoldingsTreemapChart({ treeData }: { treeData: TreeData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={treeData}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="none"
        isAnimationActive={false}
        content={TreemapCell}
      />
    </ResponsiveContainer>
  );
});

function TreemapHoverLayer({ children }: { children: React.ReactNode }) {
  const [hover, setHoverState] = useState<TreemapHover | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const setHover = useCallback((next: TreemapHover | null) => {
    if (!next) {
      setHoverState(null);
      return;
    }

    const el = tooltipRef.current;
    if (el) {
      el.style.left = `${next.x}px`;
      el.style.top = `${next.y}px`;
    }

    setHoverState((prev) => {
      if (
        prev &&
        prev.stock_code === next.stock_code &&
        prev.weight === next.weight &&
        prev.returnPct === next.returnPct &&
        prev.fill === next.fill
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const hoverContext = useMemo(() => ({ setHover }), [setHover]);

  return (
    <TreemapHoverContext.Provider value={hoverContext}>
      <div className="holdings-treemap-wrap" onMouseLeave={() => setHover(null)}>
        {children}
        {hover ? <TreemapHoverTooltip hover={hover} tooltipRef={tooltipRef} /> : null}
      </div>
    </TreemapHoverContext.Provider>
  );
}

type Props = {
  holdings: TreemapHolding[];
  etfName: string;
  holdingsDate?: string;
  priceAsOfDate?: string;
};

export function EtfHoldingsTreemap({
  holdings,
  etfName,
  holdingsDate,
  priceAsOfDate,
}: Props) {
  const stats = useMemo(() => summarizeTreemapStats(holdings), [holdings]);

  const treeData = useMemo(
    () => [
      {
        name: etfName,
        children: holdings.map((row) => ({
          ...row,
          name: row.stock_name ?? row.stock_code,
          size: row.weight,
        })),
      },
    ],
    [holdings, etfName],
  );

  if (!holdings.length) {
    return (
      <div className="card">
        <h2 className="section-title mb-2">비중 트리맵</h2>
        <p className="text-sm text-[var(--muted)]">구성종목·비중 데이터가 아직 없습니다.</p>
      </div>
    );
  }

  const metaParts = [
    holdingsDate ? `종목 기준일 ${formatTreemapDate(holdingsDate)}` : null,
    priceAsOfDate ? `시세 ${formatTreemapDate(priceAsOfDate)}` : null,
  ].filter(Boolean);

  return (
    <div className="card space-y-4">
      {metaParts.length ? (
        <p className="text-xs text-[var(--muted)]">{metaParts.join(" · ")}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <span className="holdings-treemap-stat">구성종목 {stats.count.toLocaleString("ko-KR")}개</span>
        <span className="holdings-treemap-stat holdings-treemap-stat--up">상승 {stats.up.toLocaleString("ko-KR")}개</span>
        <span className="holdings-treemap-stat holdings-treemap-stat--down">하락 {stats.down.toLocaleString("ko-KR")}개</span>
        <span className="holdings-treemap-stat">보합 {stats.flat.toLocaleString("ko-KR")}개</span>
        <span className="holdings-treemap-stat">비중합계 {formatNumber(stats.totalWeight, 1)}%</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">비중 트리맵</h2>
        <div className="holdings-treemap-legend" aria-hidden>
          <span className="holdings-treemap-legend__label">-5%</span>
          <div className="holdings-treemap-legend__steps">
            {TREEMAP_LEGEND_ORDER.map((step) => (
              <span
                key={step}
                className="holdings-treemap-legend__step"
                style={{ background: TREEMAP_BUCKET_COLORS[step] }}
                title={`${step > 0 ? "+" : ""}${step}%`}
              />
            ))}
          </div>
          <span className="holdings-treemap-legend__label">+5%</span>
        </div>
      </div>

      <TreemapHoverLayer>
        <HoldingsTreemapChart treeData={treeData} />
      </TreemapHoverLayer>

      <p className="text-xs text-[var(--muted)]">
        사각형 크기는 비중, 색은 전일 대비 1일 수익률입니다.{" "}
        <Link href="/stocks" className="font-semibold text-[var(--accent)] hover:underline">
          종목 상세
        </Link>
        로 이동할 수 있습니다.
      </p>
    </div>
  );
}
