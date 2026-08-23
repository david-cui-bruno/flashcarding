import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy — Dory" };

// Public page (see lib/supabase/proxy.ts isPublic). Required for App Store
// submission (privacy policy URL) and linked from /support.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dory Privacy Policy</h1>
        <p className="text-sm text-neutral-500">Last updated: August 23, 2026</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm leading-6">
          <li>
            <strong>Account data:</strong> a username and password. We do not require an
            email address.
          </li>
          <li>
            <strong>Study content:</strong> documents you upload or paste, the flashcards
            generated from them, and your edits.
          </li>
          <li>
            <strong>Study activity:</strong> review history and scheduling state (used by
            the FSRS algorithm to schedule your cards) and card-quality feedback.
          </li>
          <li>
            <strong>Notifications:</strong> if you enable reminders, a push subscription
            for your device and your chosen reminder time.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">How it is used</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm leading-6">
          <li>Documents you submit are sent to an AI provider (Anthropic) solely to generate your flashcards.</li>
          <li>Your study data is used only to schedule reviews and show you your own metrics.</li>
          <li>We do not sell your data, show ads, or share your content with third parties beyond the processors above.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Where it lives</h2>
        <p className="text-sm leading-6">
          Data is stored with our hosting providers (Supabase and Vercel) in the United
          States. Uploaded documents are processed for card generation and stored so you
          can trace cards back to their source.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Your choices</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm leading-6">
          <li>You can delete decks and cards at any time from within the app.</li>
          <li>You can disable notifications at any time in Settings.</li>
          <li>
            To delete your account and all associated data, contact us via the{" "}
            <Link href="/support" className="underline">
              support page
            </Link>
            .
          </li>
        </ul>
      </section>

      <footer className="pt-4 text-sm text-neutral-500">
        <Link href="/login" className="underline">
          Back to Dory
        </Link>
      </footer>
    </main>
  );
}
