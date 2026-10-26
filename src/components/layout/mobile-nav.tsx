"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { cartItemCount } from "@/lib/cart";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";

const items = [
  { label: "Home", href: "/", icon: Home },
  { label: "Categories", href: "/products", icon: LayoutGrid },
  { label: "Cart", href: "/cart", icon: ShoppingBag, countKey: "cart" as const },
  {
    label: "Wishlist",
    href: "/wishlist",
    icon: Heart,
    countKey: "wishlist" as const,
  },
  { label: "Account", href: "/profile", icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const cartCount = useCartStore((state) => cartItemCount(state.items));
  const wishlistCount = useWishlistStore((state) => state.items.length);

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="flex items-stretch">
        {items.map(({ label, href, icon: Icon, countKey }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          const count =
            countKey === "cart"
              ? cartCount
              : countKey === "wishlist"
                ? wishlistCount
                : 0;
          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" aria-hidden />
                  {count ? (
                    <span className="absolute -right-2 -top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-white">
                      {count}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
