"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ShoppingBag, X, ArrowRight } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { cartLineKey, cartSubtotal } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { CartItemRow } from "@/components/commerce/cart-item";

export function HugBag({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const items = useCartStore((s) => s.items);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-xl border-0 bg-white p-0 text-ink shadow-xl backdrop:bg-ink/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line p-6">
          <div>
            <h2 className="text-xl font-bold">Your Hug Bag</h2>
            <p className="mt-1 text-xs text-muted">
              A little something for every part of your life.
            </p>
          </div>
          <button
            className="zv-button"
            onClick={onClose}
            aria-label="Close Hug Bag"
          >
            <X />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {items.length ? (
            items.map((line) => (
              <CartItemRow key={cartLineKey(line)} line={line} />
            ))
          ) : (
            <div className="empty-state">
              <ShoppingBag />
              <h3>Your bag needs a hug</h3>
              <p>Fill it with your favourite everyday essentials.</p>
              <button className="zv-button primary" onClick={onClose}>
                Keep shopping
              </button>
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="border-t border-line p-6">
            <div className="mb-3 flex justify-between">
              <span>Merchandise subtotal</span>
              <strong>{formatPrice(cartSubtotal(items))}</strong>
            </div>
            <p className="mb-4 text-xs text-muted">
              Delivery, discounts and taxes are calculated at checkout.
            </p>
            <Link
              href="/checkout"
              onClick={onClose}
              className="zv-button amber w-full"
            >
              Proceed to Checkout
              <ArrowRight />
            </Link>
            <Link
              href="/cart"
              onClick={onClose}
              className="mt-3 block text-center text-xs text-primary underline"
            >
              View full Hug Bag
            </Link>
          </div>
        )}
      </div>
    </dialog>
  );
}
