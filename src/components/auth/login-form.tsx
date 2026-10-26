"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmail, signInWithGoogle } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { toastError, toastSuccess } from "@/stores/toast.store";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const finish = () => router.replace(next);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signInWithEmail(email, password);
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      toastError("Sign in failed", result.reason);
      return;
    }
    toastSuccess("Welcome back");
    finish();
  };

  const onGoogle = async () => {
    setPending(true);
    setError(null);
    const result = await signInWithGoogle();
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      toastError("Sign in failed", result.reason);
      return;
    }
    toastSuccess("Welcome back");
    finish();
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
        Sign in
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        Access your orders, wishlist and saved addresses.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
        </div>
        {error ? (
          <p className="text-[13px] text-primary" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12px] text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={onGoogle}
      >
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-[13px] text-muted">
        New to Zenvexa?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </Card>
  );
}
