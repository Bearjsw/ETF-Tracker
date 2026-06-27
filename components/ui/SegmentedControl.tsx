"use client";

import { cn } from "@/lib/cn";

export type SegmentItem<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: Props<T>) {
  return (
    <div className={cn("segmented-control", className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.value === value;
        const ariaLabelText =
          item.count != null ? `${item.label} ${item.count.toLocaleString("ko-KR")}` : item.label;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={ariaLabelText}
            className={cn("segmented-item", active && "segmented-item-active")}
            onClick={() => onChange(item.value)}
          >
            <span className="segmented-item__inner">
              <span>{item.label}</span>
              {item.count != null ? (
                <span className="segmented-item__count">{item.count.toLocaleString("ko-KR")}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
