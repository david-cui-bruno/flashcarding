import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "./_pwa/service-worker-registrar";
import { NativeClass } from "./_pwa/native-class";

// Locked type system (docs/design/DECISIONS.md): Schibsted Grotesk for body/UI
// (self-hosted via next/font), Switzer 200 for display numbers (Fontshare CDN,
// loaded in <head> below — only two thin weights, tiny payload).
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

// Next auto-injects <link rel="manifest"> from app/manifest.ts; appleWebApp +
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
    <html lang="en" className={`h-full antialiased ${schibsted.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=switzer@200,300&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistrar />
        <NativeClass />
      </body>
    </html>
  );
}
