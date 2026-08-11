import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brandColors } from "@/lib/brand";
import Header from "@/components/Header";

/**
 * Root layout metadata (AC-11 SEO/meta).
 *
 *   - `<title>FlavorFind — Best Restaurants in Nigeria</title>` (set via
 *     `metadata.title.template` + `default` so every page inherits a
 *     consistent "<page> | FlavorFind" pattern; per-page `title` strings
 *     override it without losing the suffix).
 *   - `description` -- hand-written, no lorem ipsum / no AI slop
 *     (AC-15 constraint).
 *   - `openGraph.images` -- references the build-time-generated
 *     `public/og.png` (AC-11 calls this asset out by name).
 *   - `metadataBase` -- absolute origin used to resolve relative OG/Twitter
 *     image URLs. Without it, Next.js emits a build-time warning and
 *     social crawlers (Twitter, Slack, iMessage, LinkedIn) sometimes
 *     drop the image when the URL is relative. Set via the
 *     `NEXT_PUBLIC_SITE_URL` env var (defaults to the Vercel preview URL
 *     pattern); the `metadataBase` documentation explicitly allows it.
 *   - `twitter` -- Twitter card metadata (large image) for parity with
 *     OpenGraph; improves link previews on X/Twitter.
 *   - `robots` -- permissive default (index + follow) so search engines
 *     crawl the listings and detail pages on launch.
 *   - `keywords`, `authors`, `creator`, `publisher` -- sensible SEO
 *     defaults; no fabricated reviews or restaurants (AC-15).
 *   - `icons` -- `/logo.svg` as the favicon (already required by AC-3
 *     and committed to the repo) plus an Apple touch icon pointing at
 *     the same SVG for parity.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://flavorfind.vercel.app",
  ),
  title: {
    default: "FlavorFind — Best Restaurants in Nigeria",
    template: "%s | FlavorFind",
  },
  description:
    "Discover the best restaurants in Nigeria, ranked by budget, city, and reviews. Live data from Google Places and Nigerian food blogs.",
  applicationName: "FlavorFind",
  keywords: [
    "Nigerian restaurants",
    "best restaurants Nigeria",
    "Lagos restaurants",
    "Abuja restaurants",
    "Port Harcourt restaurants",
    "food blog Nigeria",
    "budget restaurants Nigeria",
    "Nigerian cuisine",
  ],
  authors: [{ name: "FlavorFind" }],
  creator: "FlavorFind",
  publisher: "FlavorFind",
  category: "food",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "FlavorFind — Best Restaurants in Nigeria",
    description:
      "Discover the best restaurants in Nigeria, ranked by budget, city, and reviews.",
    url: "/",
    siteName: "FlavorFind",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "FlavorFind — best restaurants in Nigeria, ranked by budget, city and reviews.",
      },
    ],
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlavorFind — Best Restaurants in Nigeria",
    description:
      "Discover the best restaurants in Nigeria, ranked by budget, city, and reviews.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "FlavorFind — best restaurants in Nigeria, ranked by budget, city and reviews.",
      },
    ],
  },
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    shortcut: ["/logo.svg"],
    apple: [{ url: "/logo.svg", type: "image/svg+xml" }],
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: brandColors.dark,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-cream text-brand-dark antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
