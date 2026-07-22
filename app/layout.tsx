import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#3E2723",
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
        {children}
      </body>
    </html>
  );
}
