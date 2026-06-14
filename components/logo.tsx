import { cn } from "@/lib/utils";

// The Dory brand mark — the app icon (white mark on a cerulean square, generated to
// public/icons by scripts/gen-icons.mjs). Rendered as a small rounded tile next to
// the wordmark; corner radius scales with size for the app-icon look.
export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/icon-512.png"
      width={size}
      height={size}
      alt="Dory"
      style={{ borderRadius: Math.round(size * 0.26) }}
      className={cn("shrink-0", className)}
    />
  );
}
