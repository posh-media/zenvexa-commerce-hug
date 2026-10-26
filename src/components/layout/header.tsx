"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Heart,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  User,
} from "lucide-react";
import { Logo } from "./logo";
import { SearchBar } from "@/components/commerce/search-bar";
import { useCartStore } from "@/stores/cart.store";
import { useUserStore } from "@/stores/user.store";
import { cartItemCount } from "@/lib/cart";
import { HugBag } from "./hug-bag";
import { useState } from "react";

export function Header() {
  const pathname = usePathname();
  const count = useCartStore((s) => cartItemCount(s.items));
  const authenticated = useUserStore((s) => s.status === "authenticated");
  const [bagOpen, setBagOpen] = useState(false);
  return (
    <>
      <div className="announcement">
        <div className="container-page">
          <div className="announcement-left">
            <span className="promo-pill">AWOOF HUG</span>
            <span>Everything Naija needs, delivered with a warm hug.</span>
          </div>
          <div className="announcement-right">
            <Link href="/help">Help & Support</Link>
            <ShieldCheck size={12} /> Secure checkout
          </div>
        </div>
      </div>
      <header className="sticky-header">
        <div className="container-page main-header">
          <Logo />
          <div className="zv-header-search">
            <SearchBar placeholder="Search phones, inverters, everyday essentials…" />
          </div>
          <div className="zv-header-actions">
            <Link
              className="desktop-action"
              href="/wishlist"
              aria-label="Wishlist"
            >
              <Heart size={19} />
            </Link>
            <Link
              className="desktop-action"
              href="/notifications"
              aria-label="Notifications"
            >
              <Bell size={19} />
            </Link>
            <Link
              href={authenticated ? "/profile" : "/login?next=/profile"}
              aria-label={authenticated ? "Your account" : "Sign in"}
            >
              <User size={19} />
            </Link>
            <button
              type="button"
              className="zv-button !border-0"
              onClick={() => setBagOpen(true)}
              aria-label={`Open Hug Bag, ${count} items`}
            >
              <ShoppingBag />
              <span className="hidden sm:inline">Hug Bag</span>
              <span className="counter">{count}</span>
            </button>
          </div>
        </div>
        <div className="nav-row">
          <div className="container-page nav-inner">
            <nav aria-label="Main navigation" className="view-tabs">
              <Link
                className={`view-tab flex items-center gap-2 ${pathname === "/" ? "active" : ""}`}
                href="/"
              >
                <Store size={15} />
                Storefront
              </Link>
              <Link
                className={`view-tab flex items-center gap-2 ${pathname === "/track-order" ? "active" : ""}`}
                href="/track-order"
              >
                <Package size={15} />
                Track Orders
              </Link>
            </nav>
            <nav className="zv-nav-links" aria-label="Shop">
              <Link href="/products">All Merchandise</Link>
              <Link href="/deals">Awoof Deals</Link>
              <Link href="/brands">Brands</Link>
              <Link href="/orders">My Orders</Link>
            </nav>
            <div className="nav-promise">
              <Truck size={14} /> Made for your everyday Naija life
            </div>
          </div>
        </div>
      </header>
      <HugBag open={bagOpen} onClose={() => setBagOpen(false)} />
    </>
  );
}
