"use client";

import { useMemo, useState } from "react";
import type { EtfMoveTag, EtfNameLookup } from "@/lib/types";
import {
  aggregateManagersFromTickers,
  aggregateMovesByEtf,
  aggregateMovesByManager,
  type AggregatedEtfTag,
  type AggregatedManagerTag,
} from "@/lib/manager-tags";
import { EtfSourceTag } from "@/components/explorer/EtfSourceTag";
import { ChevronIcon } from "@/components/ui/ChevronIcon";
import { formatManagerDisplay } from "@/lib/managers";

type MoveProps = {
  moves: EtfMoveTag[];
  collapseLimit?: number;
  labelMode?: "manager" | "etfName";
};

type PillProps = {
  tickers: string[];
  etfMap?: EtfNameLookup;
  collapseLimit?: number;
};

type Props = MoveProps | PillProps;

function isMoveProps(props: Props): props is MoveProps {
  return "moves" in props;
}

function renderMoveTag(item: AggregatedEtfTag | AggregatedManagerTag, labelMode: "manager" | "etfName") {
  const key = labelMode === "etfName" ? item.etfTicker : ("managerKey" in item ? item.managerKey : item.etfTicker);

  return (
    <EtfSourceTag
      key={key}
      etfTicker={item.etfTicker}
      etfName={"etfName" in item ? item.etfName : undefined}
      manager={item.manager}
      changeType={item.changeType}
      flowKrw={item.flowKrw}
      labelMode={labelMode}
    />
  );
}

export function ManagerTagList(props: Props) {
  const collapseLimit = props.collapseLimit ?? 4;
  const [expanded, setExpanded] = useState(false);
  const labelMode = isMoveProps(props) ? (props.labelMode ?? "manager") : "manager";

  const flowItems = useMemo((): Array<AggregatedEtfTag | AggregatedManagerTag> => {
    if (!isMoveProps(props)) return [];
    return labelMode === "etfName"
      ? aggregateMovesByEtf(props.moves)
      : aggregateMovesByManager(props.moves);
  }, [props, labelMode]);

  const pillItems = useMemo(
    () =>
      !isMoveProps(props) ? aggregateManagersFromTickers(props.tickers, props.etfMap) : [],
    [props],
  );

  const total = isMoveProps(props) ? flowItems.length : pillItems.length;
  const hiddenCount = Math.max(total - collapseLimit, 0);
  const showExpand = !expanded && hiddenCount > 0;
  const expandLabel = labelMode === "etfName" ? "ETF" : "운용사";

  if (!total) return null;

  const visibleFlowItems = expanded ? flowItems : flowItems.slice(0, collapseLimit);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isMoveProps(props)
        ? visibleFlowItems.map((item) => renderMoveTag(item, labelMode))
        : (expanded ? pillItems : pillItems.slice(0, collapseLimit)).map((item) => (
            <span
              key={item.managerKey}
              className="inline-flex items-center rounded-full bg-[#f0f2ef] px-3 py-1 text-xs font-semibold text-[var(--foreground)]"
            >
              {formatManagerDisplay(item.manager)}
            </span>
          ))}

      {showExpand ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white text-[var(--muted)] transition-colors hover:border-[#c5d4c0] hover:text-[var(--foreground)]"
          aria-label="더보기"
          title="더보기"
        >
          <ChevronIcon direction="right" size={14} />
        </button>
      ) : null}

      {expanded && total > collapseLimit ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white text-[var(--muted)] transition-colors hover:border-[#c5d4c0] hover:text-[var(--foreground)]"
          aria-label="접기"
          title="접기"
        >
          <ChevronIcon direction="left" size={14} />
        </button>
      ) : null}
    </div>
  );
}
