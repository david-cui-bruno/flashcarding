import {
  ArrowRight,
  Check,
  FileSearch,
  Layers3,
  Sparkles,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ProductPreview } from "@/components/marketing/product-preview";

const features = [
  {
    icon: FileSearch,
    title: "Grounded in your source",
    copy: "Dory builds focused cards from your documents and keeps the original context close by.",
  },
  {
    icon: Layers3,
    title: "Study the way Anki users expect",
    copy: "Import .apkg decks, grade every answer, and let FSRS schedule the next review.",
  },
  {
    icon: WifiOff,
    title: "Review without a connection",
    copy: "Your recent decks stay ready offline. Grades sync automatically when you reconnect.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Dory home">
          <Logo size={34} />
          <span className="text-lg font-semibold tracking-tight">Dory</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Primary navigation">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
          >
            Start free
          </Link>
        </nav>
      </header>

      <section className="relative px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:pb-28">
        <div className="absolute inset-x-0 top-0 -z-0 mx-auto h-[36rem] max-w-5xl rounded-full bg-[radial-gradient(circle_at_center,rgba(14,126,194,0.13),transparent_67%)]" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            <Sparkles className="size-3.5" />
            AI flashcards that stay true to the source
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Remember what you read.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl">
            Turn documents into clean, grounded flashcards. Dory pairs careful AI
            generation with FSRS scheduling so the right ideas come back at the right time.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-[0_12px_32px_-14px_rgba(14,126,194,0.9)] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Start studying free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-6 font-semibold shadow-sm transition-colors hover:bg-muted sm:w-auto"
            >
              Open Dory
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Unlimited studying is free. No credit card required.
          </p>
        </div>

        <div className="relative z-10 mx-auto mt-16 max-w-6xl sm:mt-20">
          <ProductPreview />
        </div>
      </section>

      <section className="border-y border-border bg-card px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              From reading to recall
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold sm:text-4xl">
              Less card maintenance. More useful memory.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="rounded-2xl border border-border bg-background p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28" id="pricing">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Simple pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Study for free. Pay only for AI generation.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Imports, unlimited review, FSRS scheduling, and offline study stay free.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
            <article className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm">
              <p className="font-semibold">Free</p>
              <p className="mt-4 text-4xl font-semibold">$0</p>
              <p className="mt-2 text-sm text-muted-foreground">For building a lasting study habit.</p>
              <ul className="mt-7 flex-1 space-y-3 text-sm">
                {[
                  "Unlimited studying",
                  "FSRS spaced repetition",
                  "Anki and text imports",
                  "Offline review",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <Check className="size-4 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-xl border border-border font-semibold hover:bg-muted"
              >
                Start free
              </Link>
            </article>

            <article className="relative flex flex-col rounded-2xl border border-primary/30 bg-accent p-7 shadow-[0_20px_60px_-36px_rgba(14,126,194,0.8)]">
              <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                Best value yearly
              </span>
              <p className="font-semibold">Dory Pro</p>
              <div className="mt-4 flex items-end gap-2">
                <p className="text-4xl font-semibold">$3.99</p>
                <p className="pb-1 text-sm text-muted-foreground">/ month</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Or $29.99 per year.</p>
              <ul className="mt-7 flex-1 space-y-3 text-sm">
                {[
                  "Everything in Free",
                  "AI card generation",
                  "Cards linked back to source context",
                  "Restore purchases on iPhone",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <Check className="size-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground hover:opacity-95"
              >
                Get started
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="mx-auto flex max-w-5xl flex-col items-center rounded-3xl bg-[#0b5e8a] px-6 py-14 text-center text-white shadow-[0_24px_70px_-40px_rgba(14,126,194,0.9)] sm:px-12 sm:py-16">
          <Logo size={50} className="ring-4 ring-white/15" />
          <h2 className="mt-6 text-balance text-3xl font-semibold sm:text-4xl">
            Read it once. Keep it with you.
          </h2>
          <p className="mt-4 max-w-xl text-balance leading-7 text-white/75">
            Bring a document, import a deck, or start with notes you already have.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-[#0b5e8a] shadow-sm"
          >
            Start studying free
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span>© 2026 Dory</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Footer navigation">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/support" className="hover:text-foreground">Support</Link>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
