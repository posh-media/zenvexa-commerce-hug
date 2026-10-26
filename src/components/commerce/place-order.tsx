"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

/** Legacy stub — checkout now places orders directly. */
export function PlaceOrder() {
  return (
    <Link
      href="/checkout"
      className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(20,92,67,0.35)] transition-all duration-200 ease-premium hover:bg-primary-600 active:scale-[0.985]"
    >
      <Lock className="h-4 w-4" aria-hidden />
      Go to checkout
    </Link>
  );
}
