import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Support — Dory" };

// Public page (see lib/supabase/proxy.ts isPublic). App Store submission
// requires a support URL.
export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dory Support</h1>
        <p className="text-sm text-neutral-500">
          Dory turns your documents into flashcards with AI and schedules them with
          spaced repetition.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Common questions</h2>
        <dl className="space-y-3 text-sm leading-6">
          <div>
            <dt className="font-medium">How do I import my Anki decks?</dt>
            <dd className="text-neutral-600">
              Go to Import and upload your <code>.apkg</code> file. Cards, decks, and
              media come across automatically.
            </dd>
          </div>
          <div>
            <dt className="font-medium">How does scheduling work?</dt>
            <dd className="text-neutral-600">
              Dory uses FSRS, the same modern algorithm Anki uses, with Anki-style
              learning steps for new and lapsed cards.
            </dd>
          </div>
          <div>
            <dt className="font-medium">A generated card looks wrong.</dt>
            <dd className="text-neutral-600">
              Use &ldquo;this card is bad&rdquo; during study, or edit it during review.
              Dory learns your taste from the cards you keep and fix.
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Contact</h2>
        <p className="text-sm leading-6">
          Email{" "}
          <a href="mailto:support@learndory.com" className="underline">
            support@learndory.com
          </a>{" "}
          and we will get back to you. Account deletion requests are honored within 30
          days.
        </p>
      </section>

      <footer className="pt-4 text-sm text-neutral-500 space-x-4">
        <Link href="/login" className="underline">
          Back to Dory
        </Link>
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
      </footer>
    </main>
  );
}
