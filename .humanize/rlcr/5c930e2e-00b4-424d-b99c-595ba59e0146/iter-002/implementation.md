Now let me update app/layout.tsx to import the brand dark color from lib/brand.ts instead of inline hex.Let me try again, being careful with the exact text. Looking at the previous Read result:

```
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
```

I see, the description in openGraph had a continuation onto two lines (with the "Discover" indented on second line). Let me retry with the exact content.