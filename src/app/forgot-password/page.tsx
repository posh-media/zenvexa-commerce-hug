import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { buildPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivateMetadata(
  "Reset password",
  "Reset your Zenvexa password.",
);

export default function ForgotPasswordPage() {
  return (
    <div className="sb-container py-12 sm:py-16">
      <ForgotPasswordForm />
    </div>
  );
}
