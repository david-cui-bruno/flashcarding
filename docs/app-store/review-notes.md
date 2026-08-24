# Dory TestFlight and App Review Notes

## Sign-In Information

Demo username: demo

Demo password: password12

The demo account contains several populated decks, cards due for study, and cards
ready for generated-card review.

## What to Test

1. **Offline study and queued sync** — Sign in with the demo account, open Decks,
   choose a populated deck, and complete at least one online review so the deck is
   cached. Disconnect the device, return to Decks, and study that cached deck.
   Grades are stored on-device and replay in order after connectivity returns.
2. **Native haptics** — On a physical iPhone, enter a study session, reveal the
   answer, and tap Again, Hard, Good, or Easy. Each grade action produces native
   haptic feedback.
3. **Sign in with Apple** — Sign out. In the iPhone app, choose Sign in with Apple
   on the login screen and complete Apple's native authorization sheet. This
   option intentionally appears only inside the native iOS app.
4. **Dory Pro subscriptions and restore** — Open Profile, then Settings. The Dory
   Pro card shows monthly and annual App Store plans. A sandbox purchase unlocks
   AI card generation. Use Restore purchases on the same card to restore the
   active entitlement.
5. **Native reminders** — In Settings, enable Study reminder and allow
   notifications. Tap Send a test to receive an immediate APNs notification.
   Tapping the notification opens the Decks library. Scheduled reminders are sent
   only when cards are due.
6. **AI card generation** — Open the center New action and submit a document or
   pasted source. AI generation requires both network access and an active Dory
   Pro entitlement; unlimited studying, imports, and offline review remain free.

## Review Context

- Dory is a native Capacitor iOS app with native Sign in with Apple, StoreKit
  subscriptions through RevenueCat, APNs reminders, haptics, and offline study.
- The app's server content is restricted to `learndory.com` and
  `www.learndory.com`.
- Dory does not show advertising, sell user data, or use cross-app tracking.
- The app uses standard HTTPS and Apple-provided platform encryption; it does not
  implement proprietary encryption.
- Monthly price: $3.99. Annual price: $29.99.

## Contact Fields at Submission Time

Before saving App Review Information, read the existing first name, last name,
phone number, and email from the signed-in App Store Connect account. Reuse those
verified account-holder values. Do not invent, infer, or store personal contact
details in this repository. If any field is blank or cannot be verified, pause for
the account holder to supply it.

## Submission Preconditions

- The selected build has completed App Store Connect processing.
- Banking, tax, and Paid Apps agreement status show no required action.
- Both subscription products are attached wherever App Store Connect requires.
- The 6.9-inch and 6.1-inch screenshot sets are uploaded and visually checked.
- App Privacy answers match `privacy-label.md`.
- The account holder confirms the final legal submission action.
