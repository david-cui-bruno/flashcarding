import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "./_pwa/service-worker-registrar";

// Typeface is the system UI font (set in globals.css via --font-sans) — native on
// every OS, no webfont to load. Next auto-injects <link rel="manifest"> from app/manifest.ts; appleWebApp +
// icons.apple add the iOS home-screen / installable-PWA meta tags.
export const metadata: Metadata = {
  title: { default: "Dory", template: "%s · Dory" },
  description: "Turn documents into high-quality flashcards and study them on a spaced schedule.",
  applicationName: "Dory",
  appleWebApp: {
    capable: true,
    title: "Dory",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
