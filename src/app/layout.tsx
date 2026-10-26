import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { PageVisitTracker } from "@/components/analytics/page-visit-tracker";
import { AppProviders } from "@/providers/app-providers";
import { CatalogNavProvider } from "@/providers/catalog-nav-provider";
import { toBrandViews, toCategoryViews } from "@/lib/catalog-view";
import {
  getBrands,
  getCategories,
  getPopularSearchTerms,
} from "@/services/catalog.service";
import { APP_NAME } from "@/constants/app";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://zenvexacommerce.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — Everything Naija needs`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Zenvexa is a premium marketplace for computers, electronics, gadgets, gaming gear, smart home devices, office equipment and networking products.",
  keywords: [
    "Zenvexa",
    "electronics",
    "gadgets",
    "laptops",
    "phones",
    "gaming",
    "smart home",
    "Nigeria",
  ],
  alternates: { canonical: siteUrl },
  icons: {
    icon: "/zenvexa-icon.svg",
    apple: "/zenvexa-icon.svg",
    shortcut: "/zenvexa-icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Everything Naija needs`,
    description:
      "Shop computers, electronics, gadgets and gaming gear with next-day delivery.",
    url: siteUrl,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Everything Naija needs`,
    description:
      "Shop computers, electronics, gadgets and gaming gear with next-day delivery.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let categories: ReturnType<typeof toCategoryViews> = [];
  let brands: ReturnType<typeof toBrandViews> = [];
  let popularSearches: string[] = [];
  try {
    const [categoryDocs, brandDocs, popular] = await Promise.all([
      getCategories(),
      getBrands(),
      getPopularSearchTerms(),
    ]);
    categories = toCategoryViews(categoryDocs);
    brands = toBrandViews(brandDocs);
    popularSearches = popular;
  } catch {
    // Layout still renders if Firestore is unavailable.
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <AppProviders>
          <CatalogNavProvider value={{ categories, brands, popularSearches }}>
            <AppShell>{children}</AppShell>
            <PageVisitTracker />
          </CatalogNavProvider>
        </AppProviders>
      </body>
    </html>
  );
}
