import Link from "next/link";
import Image from "next/image";
import { ZenvexaCatalog } from "@/components/commerce/zenvexa-catalog";
import { CatalogError } from "@/components/commerce/catalog-state";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Package,
  ShieldCheck,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import {
  getActiveProducts,
  getHomeCatalogSections,
} from "@/services/products.service";
import { getCategories } from "@/services/catalog.service";
import { toCategoryViews } from "@/lib/catalog-view";
import { toProductView, toProductViews } from "@/lib/product-view";
import { formatPrice } from "@/lib/utils";
import { CatalogRail } from "@/components/commerce/catalog-state";
import { RecentlyViewedRail } from "@/components/commerce/recently-viewed";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import {
  buildListingMetadata,
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildListingMetadata({
  title: "Everything Naija Needs",
  description:
    "Your everyday Nigerian marketplace. Shop smarter, feel the warmest hug in Nigerian retail.",
  path: "/",
});
export default async function HomePage() {
  let failed = false;
  let products: Awaited<ReturnType<typeof getActiveProducts>> = [];
  let home: Awaited<ReturnType<typeof getHomeCatalogSections>> | undefined;
  let categories: ReturnType<typeof toCategoryViews> = [];
  let catalogCategories: { id: string; name: string; slug: string }[] = [];
  try {
    const [h, c, all] = await Promise.all([
      getHomeCatalogSections(8),
      getCategories(),
      getActiveProducts(),
    ]);
    home = h;
    categories = toCategoryViews(c);
    catalogCategories = c.map(({ id, name, slug }) => ({ id, name, slug }));
    products = all;
  } catch {
    failed = true;
  }
  const deal = home?.heroSource ? toProductView(home.heroSource) : undefined;
  const sections = [
    {
      title: "Your Everyday, Upgraded.",
      sub: "Handpicked essentials. Great value. A warm hug for your everyday.",
      items: home?.featured ?? [],
    },
    {
      title: "Awoof Finds",
      sub: "Discover the latest offers from our live catalogue.",
      items: home?.flash ?? [],
    },
    {
      title: "Trending in Naija",
      sub: "Find your next everyday favourite.",
      items: home?.trending ?? [],
    },
    {
      title: "Fresh Hugs, Just Arrived",
      sub: "The newest additions to your everyday.",
      items: home?.recent ?? [],
    },
  ];
  return (
    <div className="container-page zv-home">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <nav className="category-strip" aria-label="Product categories">
        <Link
          href="/products"
          className="category-pill inline-flex items-center"
        >
          All Merchandise
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            className="category-pill inline-flex items-center"
            href={`/category/${c.slug}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <section className="hero">
        <Image
          className="hero-image"
          src="/zenvexa/commerce-hero.jpg"
          alt="Everyday Nigerian essentials, from portable power to pantry and Adire"
          width={1536}
          height={1024}
          priority
        />
        <div className="hero-copy">
          <div className="hero-eyebrow">Made for your everyday Naija life</div>
          <h1>
            Shop Smarter,
            <br />
            Feel the <em>Warmest Hug</em>
            <br />
            in Nigerian Retail.
          </h1>
          <p>
            From keeping the lights on to looking your best.
            <br />
            Everything Naija needs, delivered with a warm hug.
          </p>
          <div className="hero-actions">
            <Link href="/deals" className="zv-button amber">
              Explore Awoof Deals
              <ArrowUpRight />
            </Link>
            <Link href="/products" className="zv-button glass">
              <Zap />
              Shop Your Everyday
            </Link>
          </div>
          <div className="hero-social">
            <BadgeCheck size={24} />
            <small>Good vibes. Great deals. Happy Naija homes.</small>
          </div>
        </div>
        {deal && (
          <div className="deal-card">
            <div className="deal-top">
              <span>
                <Zap size={12} />
                FEATURED HUG PICK
              </span>
            </div>
            <div className="deal-body">
              {deal.thumbnail && (
                <Image
                  className="deal-thumb"
                  src={deal.thumbnail}
                  alt={deal.name}
                  width={68}
                  height={66}
                />
              )}
              <div>
                <Link href={`/product/${deal.slug}`}>
                  <h3>{deal.name}</h3>
                </Link>
                <strong className="deal-price">
                  {formatPrice(deal.price)}
                </strong>
                {deal.oldPrice && <del>{formatPrice(deal.oldPrice)}</del>}
              </div>
            </div>
            <div className="mt-3">
              <AddToCartButton product={deal} variant="text" />
            </div>
          </div>
        )}
      </section>
      <div className="trust-grid">
        {[
          {
            icon: Truck,
            title: "Your Everyday, Delivered",
            sub: "Choose your delivery option at checkout",
          },
          {
            icon: Wallet,
            title: "Flexible Naija Payments",
            sub: "Secure payment options for your order",
          },
          {
            icon: ShieldCheck,
            title: "Shopping with Care",
            sub: "Support when you need a helping hand",
          },
          {
            icon: Package,
            title: "More Value, More Hugs",
            sub: "Explore our latest offers",
          },
        ].map((t) => (
          <div className="trust-item" key={t.title}>
            <div className="trust-icon">
              <t.icon />
            </div>
            <div>
              <h3>{t.title}</h3>
              <p>{t.sub}</p>
            </div>
          </div>
        ))}
      </div>
      {(failed ? sections.slice(0, 1) : sections).map((s, i) => (
        <section
          className="zv-section"
          id={i === 0 ? "catalog" : undefined}
          key={s.title}
        >
          <div className="section-heading">
            <div>
              <h2>{s.title}</h2>
              <p>{s.sub}</p>
            </div>
            <Link
              href={i === 1 ? "/deals" : "/products"}
              className="flex items-center gap-2 text-xs font-semibold text-primary"
            >
              Explore all
              <ArrowRight size={14} />
            </Link>
          </div>
          {i === 0 ? (
            failed ? (
              <CatalogError />
            ) : (
              <ZenvexaCatalog items={toProductViews(products)} categories={catalogCategories} />
            )
          ) : (
            <CatalogRail items={toProductViews(s.items)} failed={failed} />
          )}
        </section>
      ))}
      <section className="zv-section">
        <RecentlyViewedRail />
      </section>
      <div className="bottom-promise">
        <div>
          <h3>Good shopping. No wahala.</h3>
          <p>Your essentials, your way—with a warm hug.</p>
        </div>
        <Link className="zv-button primary" href="/products">
          Explore All Merchandise
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}
