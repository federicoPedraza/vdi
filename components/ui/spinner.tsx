"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type SpinnerProps = {
  size?: number;
  className?: string;
  "aria-label"?: string;
};

export function Spinner({
  size = 20,
  className,
  "aria-label": ariaLabel = "Loading",
}: SpinnerProps) {
  const sizeStyle: React.CSSProperties = { width: size, height: size };
  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: `url(/svg/doodles/loading.svg)`,
    maskImage: `url(/svg/doodles/loading.svg)`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    backgroundColor: "currentColor",
  };

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "inline-block align-middle text-cyan-400 animate-spin",
        className,
      )}
      style={{ ...sizeStyle, ...maskStyle }}
    />
  );
}
