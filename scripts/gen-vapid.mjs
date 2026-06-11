// Generate a VAPID keypair for Web Push (daily study reminders).
// Usage: pnpm gen:vapid   — then paste the output into .env.local
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Add these to .env.local (the public key is also exposed to the browser):

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:you@example.com
`);
