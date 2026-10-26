import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata(
  "Sign in",
  "Sign in to your Zenvexa account.",
);

export default function LoginPage() {
  return (
    <div className="sb-container py-12 sm:py-16">
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-muted">Loading…</div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
