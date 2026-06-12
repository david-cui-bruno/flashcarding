import { Skeleton } from "@/components/ui/skeleton";

// Instant skeleton while the review queue loads (focus chrome). Mirrors the review
// layout: progress bar on top, term/definition in the middle, triage chips below.
export default function ReviewLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[720px] pl-6 pr-14 pt-6 md:px-6">
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center">
        <div className="w-full max-w-[620px] space-y-3.5">
          <Skeleton className="mx-auto h-7 w-1/2" />
          <Skeleton className="mx-auto h-7 w-3/4" />
        </div>
      </div>
      <div className="flex justify-center gap-3.5 px-6 pb-10">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
      </div>
    </div>
  );
}
