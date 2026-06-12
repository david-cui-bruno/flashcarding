import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "./_pwa/service-worker-registrar";

// Inter is the design's typeface (see .context/mockups/theme.css). Loaded as a
// CSS variable so globals.css can reference it via --font-sans.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Next auto-injects <link rel="manifest"> from app/manifest.ts; appleWebApp +
// icons.apple add the iOS home-screen / installable-PWA meta tags.
export const metadata: Metadata = {
  title: { default: "Cardstock", template: "%s · Cardstock" },
  description: "Turn documents into high-quality flashcards and study them on a spaced schedule.",
  applicationName: "Cardstock",
  appleWebApp: {
    capable: true,
    title: "Cardstock",
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
  themeColor: "#111111",
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
