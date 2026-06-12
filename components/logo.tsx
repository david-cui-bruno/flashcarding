import { cn } from "@/lib/utils";

// The Cardstock mark — a card with a flap, matching .context/mockups.
export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-primary", className)}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="13" height="16" rx="2" />
      <path d="M8 5V3.5A1.5 1.5 0 0 1 9.5 2h9A1.5 1.5 0 0 1 20 3.5V17" />
    </svg>
  );
}
