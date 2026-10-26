"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { resetPassword } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { toastError, toastSuccess } from "@/stores/toast.store";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await resetPassword(email);
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      toastError("Reset failed", result.reason);
      return;
    }
    setSent(true);
    toastSuccess("Reset link sent", "Check your email for the next step.");
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
        Reset password
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        We will email you a link to choose a new password.
      </p>

      {sent ? (
        <p className="mt-6 text-[14px] text-emerald-700">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error ? (
            <p className="text-[13px] text-primary" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-[13px] text-muted">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
