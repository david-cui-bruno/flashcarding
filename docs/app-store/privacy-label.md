# Dory App Privacy Label

This document maps the production data flow to Apple's App Privacy form. All
listed data is used for App Functionality. Dory does not use data for third-party
advertising, developer advertising or marketing, or tracking.

## Data Collected and Linked to the User

| Apple data type | Dory examples | Linked to identity | Purpose |
|---|---|---:|---|
| Contact Info — Email Address | Email supplied by Sign in with Apple when Apple provides it | Yes | Account authentication and recovery through the authentication provider |
| Identifiers — User ID | Supabase Auth UUID and the account username | Yes | Authentication, ownership, synchronization, and access control |
| Identifiers — Device ID | APNs device token or Web Push endpoint when reminders are enabled | Yes | Delivering the user's optional study reminders |
| User Content — Other User Content | Uploaded or pasted source documents, normalized source text, deck names, flashcard terms and definitions, source excerpts, edits, and card media | Yes | Importing content, generating cards, showing source context, studying, and syncing |
| Usage Data — Product Interaction | Review grades, FSRS scheduling state, review timestamps, generation-job status, and card-quality feedback | Yes | Scheduling reviews, syncing study progress, showing metrics, and improving the user's generated cards |
| Purchases — Purchase History | Dory Pro product, entitlement status, expiration, and RevenueCat app user identifier | Yes | Processing, restoring, and enforcing the user's subscription entitlement |

Push identifiers are collected only after the user opts into reminders. Source
documents are collected only when the user submits or imports them. Purchase data
exists only when the App Store or RevenueCat reports a subscription event.

## Tracking

- Data Used to Track You: None.
- Dory does not link app data with third-party data for advertising or advertising
  measurement.
- Dory does not share data with a data broker.
- Dory contains no third-party advertising SDK.
- Ask App Not to Track prompt required: No, because Dory performs no tracking as
  Apple defines it.

## Processors and Purposes

These services are processors or infrastructure, not separate App Store data
types:

- Supabase: authentication, private database records, and private storage.
- Vercel: web application hosting, server functions, and operational request
  handling.
- RevenueCat: App Store subscription purchase and entitlement processing.
- Anthropic: processing user-submitted source content to generate flashcards when
  the user invokes the Pro AI-generation feature.
- Apple Push Notification service and browser push services: delivery of optional
  reminder notifications.

No processor is used by Dory to sell personal data or serve third-party ads.

## Form Review Checklist

- Confirm every collected category above is marked as linked to the user's
  account, because the production schema associates it with `user_id` or the
  authenticated RevenueCat app user identifier.
- Leave Analytics, Product Personalization, Third-Party Advertising, Developer
  Advertising or Marketing, and Other Purposes unchecked unless the production
  implementation changes before submission.
- Keep Data Used to Track You empty.
- Verify https://learndory.com/privacy returns HTTP 200 immediately before saving
  or publishing the privacy answers.
