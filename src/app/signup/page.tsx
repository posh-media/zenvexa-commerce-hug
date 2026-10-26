import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata(
  "Create account",
  "Create a Zenvexa account.",
);

export default function SignupPage() {
  return (
    <div className="sb-container py-12 sm:py-16">
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-muted">Loading…</div>
        }
      >
        <SignupForm />
      </Suspense>
    </div>
  );
}
