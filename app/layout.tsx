import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ScrollToHash from "@/components/ScrollToHash";
import { SEO } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SEO.baseUrl),
  title: {
    default: SEO.title,
    template: `%s | ${SEO.siteName}`,
  },
  description: SEO.description,
  keywords: SEO.keywords,
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: SEO.ogTitle,
    description: SEO.ogDescription,
    type: "website",
    url: SEO.baseUrl,
    images: [{ url: SEO.ogImageUrl, alt: SEO.ogTitle }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: SEO.siteName,
    image: SEO.ogImageUrl,
    logo: SEO.logoUrl,
    url: SEO.baseUrl,
    telephone: SEO.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SEO.address.locality,
      addressRegion: SEO.address.region,
      postalCode: SEO.address.postalCode,
      addressCountry: SEO.address.country,
    },
    areaServed: SEO.areaServed,
    priceRange: SEO.priceRange,
    openingHours: SEO.openingHours,
  }

  return (
    <html lang="en">
      <body className="antialiased flex flex-col min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Navigation />
        <ScrollToHash />
        <main className="flex-1 bg-cream">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
