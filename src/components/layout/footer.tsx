"use client";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "./logo";
import { useCatalogNav } from "@/providers/catalog-nav-provider";
export function Footer() {
  const { categories } = useCatalogNav();
  return (
    <footer className="footer">
      <div className="container-page">
        <div className="footer-grid">
          <div className="zv-footer-logo">
            <Logo tone="light" />
            <p className="footer-about">
              From the big upgrades to the little essentials, we bring
              everything Naija needs closer—with care, value, and a warm hug.
            </p>
            <span className="text-xs text-amber-300">
              Everything Naija Needs, Delivered with a Warm Hug.
            </span>
          </div>
          <div>
            <h4>Shop Your Everyday</h4>
            <div className="footer-list">
              <Link href="/products">All Merchandise</Link>
              <Link href="/deals">Awoof Deals</Link>
              {categories.slice(0, 5).map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}`}>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4>Your Zenvexa</h4>
            <div className="footer-list">
              <Link href="/profile">My Account</Link>
              <Link href="/orders">My Orders</Link>
              <Link href="/track-order">Track an Order</Link>
              <Link href="/wishlist">Saved Favourites</Link>
              <Link href="/addresses">Delivery Addresses</Link>
            </div>
          </div>
          <div>
            <h4>We’re Here for You</h4>
            <div className="footer-list">
              <Link href="/help">Help & Support</Link>
              <Link href="/refund-request">Request a Refund</Link>
              <Link href="/notifications">Notifications</Link>
              <Link href="/settings">Preferences</Link>
            </div>
            <h4 className="mt-5">Pay Your Naija Way</h4>
            <p className="text-xs">
              Available payment options appear at checkout.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Zenvexa Commerce Hug. Made for Naija,
            with love.
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck size={13} />
            Secure Nigerian Payments
          </span>
        </div>
      </div>
    </footer>
  );
}
