import { Skeleton } from "@/components/ui/skeleton";

// Instant skeleton while the gate/session data loads. Rendered inside the focus
// chrome (rail + close), so navigating into study feels immediate even on a cold
// serverless start. Having this boundary also lets <Link> prefetch the shell.
export default function StudyLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center">
        <div className="w-full max-w-[620px] space-y-3.5">
          <Skeleton className="mx-auto h-7 w-3/4" />
          <Skeleton className="mx-auto h-7 w-2/3" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 px-6 pb-8">
        <Skeleton className="h-11 w-52 rounded-md" />
      </div>
    </div>
  );
}
