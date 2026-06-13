import { useId } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { mark: 24, text: "text-h3" },
  md: { mark: 32, text: "text-h1" },
  lg: { mark: 44, text: "text-display" },
} as const;

export function LogoMark({
  className,
  monochrome = false,
  style,
}: {
  className?: string;
  monochrome?: boolean;
  style?: React.CSSProperties;
}) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn(!monochrome && "drop-shadow-[0_2px_6px_rgba(13,148,136,0.35)]", className)}
      style={style}
      role="img"
      aria-label="Hisably"
      xmlns="http://www.w3.org/2000/svg"
    >
      {!monochrome && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
        </defs>
      )}
      {!monochrome && <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />}
      <path
        d="M11 8v16M21 8v16M11 16h10"
        stroke={monochrome ? "currentColor" : "white"}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  className,
  size = "md",
  monochrome = false,
}: {
  className?: string;
  size?: keyof typeof SIZES;
  monochrome?: boolean;
}) {
  const { mark, text } = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark monochrome={monochrome} style={{ width: mark, height: mark }} />
      <span className={cn(text, "font-semibold tracking-tight")}>Hisably</span>
    </span>
  );
}
