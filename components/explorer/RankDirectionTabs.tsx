"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/utils";

type Direction = "up" | "down";

type Props = {
  value: Direction;
  onChange: (value: Direction) => void;
  className?: string;
};

export function RankDirectionTabs({ value, onChange, className }: Props) {
  return (
    <SegmentedControl
      className={cn("segmented-control-compact", className)}
      items={[
        { value: "up" as const, label: "상승" },
        { value: "down" as const, label: "하락" },
      ]}
      value={value}
      onChange={onChange}
      ariaLabel="상승·하락 순위"
    />
  );
}
