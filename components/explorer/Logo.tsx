"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getManagerLogoCandidates,
  getStockLogoCandidates,
} from "@/lib/logos";
import { cn } from "@/lib/utils";

type LogoVariant = "plain" | "circle" | "framed";

type BaseProps = {
  size?: number;
  className?: string;
  alt?: string;
  variant?: LogoVariant;
  imageFill?: string;
};

type StockProps = BaseProps & {
  stockName?: string | null;
  stockCode?: string | null;
};

type ManagerProps = BaseProps & {
  manager?: string | null;
};

function useLogoSrc(candidates: string[]) {
  const stableKey = candidates.join("|");
  const stable = useMemo(() => candidates, [stableKey]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [stableKey]);

  const src = stable[Math.min(index, stable.length - 1)] ?? stable[0];

  const onError = useCallback(() => {
    setIndex((prev) => (prev < stable.length - 1 ? prev + 1 : prev));
  }, [stable.length]);

  return { src, onError };
}

function LogoImage({
  src,
  onError,
  alt,
  size,
  className,
  fill = "72%",
}: {
  src: string;
  onError: () => void;
  alt: string;
  size: number;
  className?: string;
  fill?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={onError}
      className={cn("object-contain", className)}
      style={{ width: fill, height: fill, maxWidth: size, maxHeight: size }}
    />
  );
}

function LogoFrame({
  src,
  onError,
  alt,
  size,
  className,
  variant = "circle",
  imageFill,
}: {
  src: string;
  onError: () => void;
  alt: string;
  size: number;
  className?: string;
  variant?: LogoVariant;
  imageFill?: string;
}) {
  if (variant === "plain") {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
        <LogoImage src={src} onError={onError} alt={alt} size={size} fill="100%" />
      </span>
    );
  }

  if (variant === "framed") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <LogoImage src={src} onError={onError} alt={alt} size={size} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3f5f2]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <LogoImage src={src} onError={onError} alt={alt} size={size} fill={imageFill ?? "62%"} />
    </span>
  );
}

export function StockLogo({
  stockName,
  stockCode,
  size = 36,
  className,
  alt,
  variant = "circle",
  imageFill,
}: StockProps) {
  const candidates = useMemo(
    () => getStockLogoCandidates(stockName, stockCode),
    [stockName, stockCode],
  );
  const { src, onError } = useLogoSrc(candidates);
  const label = alt ?? stockName ?? stockCode ?? "종목";

  return (
    <LogoFrame
      src={src}
      onError={onError}
      alt={label}
      size={size}
      className={className}
      variant={variant}
      imageFill={imageFill}
    />
  );
}

export function ManagerLogo({ manager, size = 18, className, alt, variant = "circle" }: ManagerProps) {
  const candidates = useMemo(() => getManagerLogoCandidates(manager), [manager]);
  const { src, onError } = useLogoSrc(candidates);
  const label = alt ?? manager ?? "운용사";

  return (
    <LogoFrame
      src={src}
      onError={onError}
      alt={label}
      size={size}
      className={className}
      variant={variant}
    />
  );
}
