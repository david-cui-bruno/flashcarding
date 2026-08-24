import { BookOpen, ChevronRight, Clock3, FileText, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";

const decks = [
  { name: "The World of Yesterday", cards: 128, due: 12, active: true },
  { name: "Behavioral economics", cards: 84, due: 7, active: false },
  { name: "Neural networks", cards: 61, due: 0, active: false },
];

export function ProductPreview() {
  return (
    <div className="relative rounded-[2rem] border border-primary/15 bg-white/55 p-2 shadow-[0_35px_100px_-45px_rgba(15,23,42,0.35)] backdrop-blur sm:p-3">
      <div className="overflow-hidden rounded-[1.55rem] border border-border bg-card">
        <div className="flex h-12 items-center justify-between border-b border-border px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <Logo size={25} />
            <span className="text-sm font-semibold">Dory</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" />
            19 due today
          </div>
        </div>

        <div className="grid min-h-[31rem] lg:grid-cols-[0.9fr_1.25fr]">
          <div className="border-b border-border bg-background/70 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Your library
                </p>
                <h2 className="mt-1 text-xl font-semibold">Decks</h2>
              </div>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
            </div>

            <div className="mt-6 space-y-2.5">
              {decks.map((deck) => (
                <div
                  key={deck.name}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                    deck.active
                      ? "border-primary/35 bg-accent shadow-sm"
                      : "border-border bg-card"
                  }`}
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${deck.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <BookOpen className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{deck.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{deck.cards} cards</p>
                  </div>
                  {deck.due > 0 ? (
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-primary shadow-sm">
                      {deck.due} due
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-success">Done</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-card/60 p-3.5 text-sm text-muted-foreground">
              <FileText className="size-4 text-primary" />
              Drop in a PDF, article, or notes
            </div>
          </div>

          <div className="flex flex-col p-5 sm:p-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>The World of Yesterday</span>
              <span className="tabular-nums">4 / 12</span>
            </div>
            <div className="mt-5 flex flex-1 flex-col justify-between rounded-2xl border border-border bg-white p-6 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.35)] sm:p-8">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  <Sparkles className="size-3.5" />
                  Question
                </div>
                <p className="mt-5 text-balance text-xl font-medium leading-8 sm:text-2xl">
                  Why did Stefan Zweig describe prewar Vienna as a city of cultural security?
                </p>
              </div>
              <div className="mt-10 border-t border-border pt-5">
                <p className="text-xs font-medium text-muted-foreground">Source context</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  “Almost every inhabitant felt himself to be a citizen of the world…”
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  View in source <ChevronRight className="size-3" />
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs font-semibold">
              <span className="rounded-lg bg-learning-soft px-2 py-2.5 text-learning">Again</span>
              <span className="rounded-lg bg-warning-soft px-2 py-2.5 text-warning">Hard</span>
              <span className="rounded-lg bg-accent px-2 py-2.5 text-primary">Good</span>
              <span className="rounded-lg bg-success-soft px-2 py-2.5 text-success">Easy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
