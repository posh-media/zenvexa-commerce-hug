import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Check,
  Cpu,
  Gamepad2,
  Headphones,
  Heart,
  Laptop,
  Monitor,
  Package,
  Percent,
  Search,
  ShoppingCart,
  Smartphone,
  Star,
  Truck,
  User,
} from "lucide-react";
import { brands, byTag, categories, orders, products } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Badge, Chip, StatusDot, Tag } from "@/components/ui/badge";
import { Card, Divider } from "@/components/ui/card";
import { Checkbox, Input, Label, Radio, Select, Textarea, Toggle } from "@/components/ui/field";
import { Rating, RatingBar } from "@/components/ui/rating";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Pagination } from "@/components/ui/pagination";
import { Tabs } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { Alert } from "@/components/ui/alert";
import { Toast, ToastDemo } from "@/components/ui/toast";
import { ModalTrigger } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/table";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCardSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyCartIllustration } from "@/components/ui/illustrations";
import { ProductCard, ProductListCard } from "@/components/commerce/product-card";
import { CategoryCard, CategoryTile } from "@/components/commerce/category-card";
import { OrderCard } from "@/components/commerce/order-card";
import { WishlistButton } from "@/components/commerce/wishlist-button";
import { SearchBar } from "@/components/commerce/search-bar";
import { Countdown } from "@/components/commerce/countdown";
import { buildPrivateMetadata } from "@/lib/seo";
import { BrandMark, ProductMedia } from "@/components/commerce/product-media";

export const metadata: Metadata = buildPrivateMetadata(
  "Component library",
  "Internal Zenvexa UI kit — not for public indexing.",
);

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line pt-12 first:border-0 first:pt-0">
      <div className="mb-6">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="mt-1.5 text-[14px] text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

const nav = [
  ["buttons", "Buttons"],
  ["inputs", "Inputs"],
  ["dropdowns", "Dropdowns"],
  ["badges", "Badges, tags & chips"],
  ["cards", "Cards"],
  ["product-cards", "Product cards"],
  ["commerce", "Commerce controls"],
  ["navigation", "Navigation"],
  ["tabs", "Tabs & accordions"],
  ["feedback", "Alerts, toasts & modals"],
  ["tables", "Tables"],
  ["icons", "Icons"],
  ["empty", "Empty states"],
  ["skeletons", "Loading skeletons"],
];

const icons = [
  { Icon: Laptop, name: "Laptop" },
  { Icon: Smartphone, name: "Smartphone" },
  { Icon: Headphones, name: "Headphones" },
  { Icon: Gamepad2, name: "Gaming" },
  { Icon: Monitor, name: "Monitor" },
  { Icon: Cpu, name: "Components" },
  { Icon: ShoppingCart, name: "Cart" },
  { Icon: Heart, name: "Wishlist" },
  { Icon: Bell, name: "Notifications" },
  { Icon: User, name: "Profile" },
  { Icon: Truck, name: "Delivery" },
  { Icon: Package, name: "Orders" },
  { Icon: Percent, name: "Deals" },
  { Icon: Star, name: "Rating" },
  { Icon: Search, name: "Search" },
  { Icon: Check, name: "Confirmed" },
];

export default function ComponentLibraryPage() {
  const product = products[0];
  const featured = byTag("featured", 4);

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Component library" }]}
        title="Component library"
        description="Every reusable piece of the Zenvexa interface in one place — the reference for anyone extending the design."
      />

      <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
        <aside className="hidden lg:block">
          <nav aria-label="Component sections" className="sticky top-28">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              On this page
            </p>
            <ul className="space-y-1">
              {nav.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block rounded-lg px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-soft hover:text-primary"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          <Section
            id="buttons"
            title="Buttons"
            description="Six variants, four sizes. Fully rounded, 200ms transitions, visible focus rings."
          >
            <Card className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="subtle">Subtle</Button>
                <Button variant="danger">Danger</Button>
              </div>
              <Divider />
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <IconButton label="Add to cart">
                  <ShoppingCart className="h-[18px] w-[18px]" aria-hidden />
                </IconButton>
                <Button disabled>Disabled</Button>
              </div>
              <Divider />
              <div className="flex flex-wrap items-center gap-3">
                <Button>
                  <ShoppingCart className="h-4 w-4" aria-hidden />
                  With leading icon
                </Button>
                <ButtonLink href="/products" variant="outline">
                  Link button
                </ButtonLink>
              </div>
            </Card>
          </Section>

          <Section
            id="inputs"
            title="Input fields"
            description="Text, email, select, textarea, checkbox, radio and toggle — all with 12px radius and consistent focus states."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-4">
                <div>
                  <Label htmlFor="c-text" hint="Required">
                    Text input
                  </Label>
                  <Input id="c-text" placeholder="Amara Bello" />
                </div>
                <div>
                  <Label htmlFor="c-icon">With icon</Label>
                  <Input
                    id="c-icon"
                    placeholder="Search products"
                    icon={<Search className="h-[18px] w-[18px]" />}
                  />
                </div>
                <div>
                  <Label htmlFor="c-select">Select</Label>
                  <Select id="c-select">
                    <option>Most relevant</option>
                    <option>Price: low to high</option>
                    <option>Newest first</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="c-area">Textarea</Label>
                  <Textarea id="c-area" placeholder="Delivery instructions…" />
                </div>
                <div>
                  <Label htmlFor="c-disabled">Disabled</Label>
                  <Input id="c-disabled" defaultValue="Locked field" disabled />
                </div>
              </Card>
              <Card className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-ink">Checkboxes</p>
                  <Checkbox label="In stock only" defaultChecked />
                  <Checkbox label="Free delivery" />
                  <Checkbox label="Same-day dispatch" />
                </div>
                <Divider />
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-ink">Radios</p>
                  <Radio name="c-radio" label="Express — free" description="Arrives tomorrow" defaultChecked />
                  <Radio name="c-radio" label="Standard — free" description="2–4 working days" />
                </div>
                <Divider />
                <div>
                  <p className="text-[13px] font-medium text-ink">Toggles</p>
                  <Toggle label="Order updates" description="Dispatch and delivery texts" defaultChecked />
                  <Toggle label="Deals email" description="Up to two a week" />
                </div>
              </Card>
            </div>
          </Section>

          <Section
            id="dropdowns"
            title="Dropdowns & search"
            description="Click-outside dismissal, listbox semantics and a search bar with suggestions."
          >
            <Card className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Dropdown
                  label="Sort"
                  options={["Most relevant", "Price: low to high", "Price: high to low", "Top rated", "Newest"]}
                />
                <Dropdown label="Show" options={["24 per page", "48 per page", "96 per page"]} />
                <Dropdown label="Currency" options={["USD", "NGN", "GBP", "EUR"]} align="right" />
              </div>
              <Divider />
              <SearchBar />
            </Card>
          </Section>

          <Section
            id="badges"
            title="Badges, tags & chips"
            description="Seven badge tones for discounts, stock and order status, plus removable filter chips."
          >
            <Card className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">-32%</Badge>
                <Badge tone="ink">New</Badge>
                <Badge tone="neutral">Default</Badge>
                <Badge tone="success">In stock</Badge>
                <Badge tone="warning">Low stock</Badge>
                <Badge tone="info">Shipped</Badge>
                <Badge tone="outline">Sold by Zenvexa</Badge>
              </div>
              <Divider />
              <div className="flex flex-wrap items-center gap-2">
                <Tag>Laptops</Tag>
                <Tag>Gaming</Tag>
                <Tag>Smart home</Tag>
                <Tag>Networking</Tag>
              </div>
              <Divider />
              <div className="flex flex-wrap items-center gap-2">
                <Chip active>Under $500</Chip>
                <Chip>Apple</Chip>
                <Chip>4 stars &amp; up</Chip>
              </div>
              <Divider />
              <div className="flex flex-wrap items-center gap-6">
                {[
                  { tone: "success", label: "Delivered" },
                  { tone: "warning", label: "Awaiting payment" },
                  { tone: "info", label: "In transit" },
                  { tone: "danger", label: "Cancelled" },
                ].map((item) => (
                  <span key={item.label} className="flex items-center gap-2 text-[13px] text-muted">
                    <StatusDot tone={item.tone as "success" | "warning" | "danger" | "info"} />
                    {item.label}
                  </span>
                ))}
              </div>
            </Card>
          </Section>

          <Section
            id="cards"
            title="Cards"
            description="The base surface: 16px radius, hairline border, optional soft shadow on hover."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <h3 className="text-[15px] font-semibold text-ink">Base card</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Static surface used for forms, summaries and panels.
                </p>
              </Card>
              <Card hover>
                <h3 className="text-[15px] font-semibold text-ink">Hover card</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Lifts 2px with a soft shadow — used for anything clickable.
                </p>
              </Card>
              <Card className="bg-soft/60">
                <h3 className="text-[15px] font-semibold text-ink">Soft card</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Tinted variant for secondary information and promos.
                </p>
              </Card>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.slice(0, 4).map((category) => (
                <CategoryCard key={category.slug} category={category} />
              ))}
            </div>
            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto">
              {categories.map((category) => (
                <CategoryTile key={category.slug} category={category} />
              ))}
            </div>
          </Section>

          <Section
            id="product-cards"
            title="Product cards"
            description="Grid and list forms: media, discount badge, wishlist toggle, rating, price pair, add to cart and quick view on hover."
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {featured.slice(0, 2).map((item) => (
                <ProductListCard key={item.id} product={item} />
              ))}
            </div>
          </Section>

          <Section
            id="commerce"
            title="Commerce controls"
            description="Ratings, quantity selector, wishlist button, order card, countdown and product media."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-5">
                <div className="space-y-3">
                  <p className="text-[13px] font-medium text-ink">Rating stars</p>
                  <Rating value={4.8} reviews={1284} />
                  <Rating value={4.2} size="md" />
                  <Rating value={3.5} size="lg" showValue={false} />
                </div>
                <Divider />
                <div className="space-y-2.5">
                  <p className="text-[13px] font-medium text-ink">Rating breakdown</p>
                  <RatingBar stars={5} count={880} total={1284} />
                  <RatingBar stars={4} count={280} total={1284} />
                  <RatingBar stars={3} count={84} total={1284} />
                </div>
              </Card>
              <Card className="space-y-5">
                <div>
                  <p className="mb-3 text-[13px] font-medium text-ink">Quantity selector</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <QuantitySelector />
                    <QuantitySelector size="sm" initial={2} />
                  </div>
                </div>
                <Divider />
                <div>
                  <p className="mb-3 text-[13px] font-medium text-ink">Wishlist button</p>
                  <div className="flex items-center gap-3">
                    <WishlistButton size="sm" />
                    <WishlistButton />
                    <WishlistButton size="lg" initial />
                  </div>
                </div>
                <Divider />
                <div>
                  <p className="mb-3 text-[13px] font-medium text-ink">Countdown</p>
                  <Countdown />
                </div>
                <Divider />
                <div>
                  <p className="mb-3 text-[13px] font-medium text-ink">Product media & brand marks</p>
                  <div className="flex items-center gap-3">
                    <ProductMedia
                      icon={product.icon}
                      tone={product.tone}
                      name={product.name}
                      className="h-20 w-20"
                      iconClassName="h-2/5 w-2/5"
                    />
                    {brands.slice(0, 4).map((brand) => (
                      <BrandMark key={brand.slug} initials={brand.initials} />
                    ))}
                  </div>
                </div>
              </Card>
            </div>
            <div className="mt-4">
              <OrderCard order={orders[0]} />
            </div>
          </Section>

          <Section
            id="navigation"
            title="Navigation"
            description="Breadcrumbs, pagination and the link styles used in the header and footer."
          >
            <Card className="space-y-6">
              <Breadcrumb
                items={[
                  { label: "Home", href: "/" },
                  { label: "Laptops", href: "/products" },
                  { label: "Gaming laptops", href: "/products" },
                  { label: product.name },
                ]}
              />
              <Divider />
              <Pagination current={3} total={9} />
              <Divider />
              <div className="flex flex-wrap items-center gap-5">
                <Link href="/products" className="text-sm font-medium text-primary hover:underline">
                  Primary link
                </Link>
                <Link href="/products" className="text-sm text-ink-soft transition-colors hover:text-primary">
                  Muted link
                </Link>
                <Link
                  href="/products"
                  className="border-b-2 border-primary pb-1 text-sm font-medium text-ink"
                >
                  Active nav item
                </Link>
              </div>
            </Card>
          </Section>

          <Section
            id="tabs"
            title="Tabs & accordions"
            description="Underline and pill tabs with counts, plus a native details-based accordion."
          >
            <Card className="space-y-8">
              <Tabs
                items={[
                  {
                    id: "overview",
                    label: "Overview",
                    content: (
                      <p className="text-[14px] leading-relaxed text-muted">
                        Underline tabs are used on product details and other content-heavy pages.
                      </p>
                    ),
                  },
                  {
                    id: "specs",
                    label: "Specifications",
                    content: (
                      <p className="text-[14px] leading-relaxed text-muted">
                        Each panel is a full region with tabpanel semantics.
                      </p>
                    ),
                  },
                  {
                    id: "reviews",
                    label: "Reviews",
                    count: 1284,
                    content: (
                      <p className="text-[14px] leading-relaxed text-muted">
                        Counts sit inside the tab as a subtle pill.
                      </p>
                    ),
                  },
                ]}
              />
              <Divider />
              <Tabs
                variant="pill"
                items={[
                  {
                    id: "all",
                    label: "All",
                    count: 12,
                    content: (
                      <p className="text-[14px] text-muted">
                        Pill tabs are used for filtering lists such as orders and notifications.
                      </p>
                    ),
                  },
                  { id: "open", label: "Open", count: 3, content: <p className="text-[14px] text-muted">Open items.</p> },
                  { id: "done", label: "Completed", count: 9, content: <p className="text-[14px] text-muted">Completed items.</p> },
                ]}
              />
            </Card>
            <div className="mt-4">
              <Accordion
                items={[
                  {
                    question: "How do accordions behave on mobile?",
                    answer:
                      "They use native details and summary elements, so they work without JavaScript and stay keyboard accessible.",
                  },
                  {
                    question: "Can more than one be open?",
                    answer: "Yes — each row is independent, and the first one is open by default.",
                  },
                ]}
              />
            </div>
          </Section>

          <Section
            id="feedback"
            title="Alerts, toasts & modals"
            description="Four alert tones, an auto-dismissing toast and a dialog with backdrop and escape handling."
          >
            <div className="space-y-3">
              <Alert tone="info" title="Delivery estimates are placeholders">
                Dates in this design are illustrative only.
              </Alert>
              <Alert tone="success" title="Free delivery unlocked">
                Your basket qualifies for free next-day delivery.
              </Alert>
              <Alert tone="warning" title="Only 3 left in stock">
                Order soon — this item is selling quickly.
              </Alert>
              <Alert tone="danger" title="Payment could not be authorised">
                Check the card details and try again.
              </Alert>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="space-y-4">
                <p className="text-[13px] font-medium text-ink">Toasts</p>
                <Toast title="Added to cart" description="MacBook Pro 14 — 1 item" />
                <Toast tone="danger" title="Could not remove item" description="Try again in a moment" />
                <div className="flex flex-wrap gap-3 pt-2">
                  <ToastDemo title="Saved to wishlist" description="We will alert you on price drops" />
                  <ToastDemo
                    tone="info"
                    title="Coupon applied"
                    description="BETA10 — $120 off"
                    label="Show info toast"
                  />
                </div>
              </Card>
              <Card className="space-y-4">
                <p className="text-[13px] font-medium text-ink">Modals & dialogs</p>
                <div className="flex flex-wrap gap-3">
                  <ModalTrigger
                    label="Open dialog"
                    title="Remove item?"
                    description="This removes the item from your cart. You can add it back at any time."
                    cancelLabel="Keep item"
                    confirmLabel="Remove"
                  />
                  <ModalTrigger
                    label="Quick view"
                    variantClass="bg-ink text-white hover:bg-ink-soft"
                    title="Quick view"
                    description="A compact preview opened from a product card."
                    cancelLabel="Close"
                    confirmLabel="Add to cart"
                  >
                    <ProductMedia
                      icon={product.icon}
                      tone={product.tone}
                      name={product.name}
                      className="aspect-[4/3] w-full"
                    />
                    <h3 className="mt-5 text-[17px] font-semibold text-ink">{product.name}</h3>
                    <p className="mt-1 text-[14px] text-muted">{product.brand}</p>
                    <p className="mt-3 text-xl font-semibold text-ink">
                      {formatPrice(product.price)}
                    </p>
                  </ModalTrigger>
                </div>
              </Card>
            </div>
          </Section>

          <Section
            id="tables"
            title="Tables"
            description="Responsive tables with a caption, sticky-feeling header tint and horizontal overflow on small screens."
          >
            <DataTable
              caption="Recent orders"
              columns={["Order", "Date", "Status", "Items", "Total"]}
              rows={orders.slice(0, 4).map((order) => [
                <span key="id" className="font-medium text-ink">
                  {order.id}
                </span>,
                order.placedOn,
                <Badge key="s" tone={order.status === "Completed" ? "success" : "neutral"}>
                  {order.status}
                </Badge>,
                order.items.length,
                <span key="t" className="font-semibold text-ink">
                  {formatPrice(order.total)}
                </span>,
              ])}
            />
          </Section>

          <Section
            id="icons"
            title="Icons"
            description="A single stroke-based icon family at 1.75px weight, sized 14–24px."
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {icons.map(({ Icon, name }) => (
                <div
                  key={name}
                  className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white p-4"
                >
                  <Icon className="h-5 w-5 text-ink" aria-hidden />
                  <span className="text-center text-[11px] text-muted">{name}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="empty"
            title="Empty states"
            description="Illustration, headline, one line of guidance and up to two actions."
          >
            <EmptyState
              illustration={<EmptyCartIllustration />}
              title="Your cart is empty"
              description="Add a product and it will show up here. Items stay in your cart for 30 days."
              actions={
                <>
                  <ButtonLink href="/products">Start shopping</ButtonLink>
                  <ButtonLink href="/empty-states" variant="outline">
                    See all empty states
                  </ButtonLink>
                </>
              }
            />
          </Section>

          <Section
            id="skeletons"
            title="Loading skeletons"
            description="Shimmering placeholders shaped like the content they replace."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProductCardSkeleton />
              <Card className="space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-10 w-32 rounded-full" />
              </Card>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </Card>
            </div>
            <div className="mt-4">
              <TableSkeleton rows={3} />
            </div>
            <div className="mt-4">
              <ButtonLink href="/loading-states" variant="outline">
                See all loading states
              </ButtonLink>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
