"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportClientException } from "@/lib/monitoring";
import { ButtonLink } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientException(error, { digest: error.digest, boundary: "error" });
  }, [error]);

  return (
    <div className="sb-container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        Something went wrong
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink">
        We couldn&apos;t load this page
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        An unexpected error occurred. You can try again or return to the shop.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
        >
          Try again
        </button>
        <ButtonLink href="/" variant="outline">
          Back to home
        </ButtonLink>
        <Link href="/help" className="text-sm text-muted underline-offset-2 hover:underline">
          Help centre
        </Link>
      </div>
    </div>
  );
}
