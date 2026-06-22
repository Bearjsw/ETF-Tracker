"use client";

import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  variant?: "default" | "stretch" | "boxed";
  ariaLabel?: string;
};

export function TabBar<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
  variant = "default",
  ariaLabel,
}: Props<T>) {
  return (
    <div
      className={cn(
        "tab-bar",
        size === "sm" && "tab-bar-sm",
        variant === "stretch" && "tab-bar-stretch",
        variant === "boxed" && "tab-bar-boxed",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn("tab-bar-item", active && "tab-bar-item-active")}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
