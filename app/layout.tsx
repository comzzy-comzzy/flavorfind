import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brandColors } from "@/lib/brand";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "FlavorFind — Best Restaurants in Nigeria",
  description:
    "Discover the best restaurants in Nigeria, ranked by budget, city, and reviews. Live data from Google Places and Nigerian food blogs.",
  openGraph: {
    title: "FlavorFind — Best Restaurants in Nigeria",
    description:
      "Discover the best restaurants in Nigeria, ranked by budget, city, and reviews.",
    images: ["/og.png"],
    type: "website",
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
