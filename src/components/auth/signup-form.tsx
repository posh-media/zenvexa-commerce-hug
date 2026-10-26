"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle, signUpWithEmail } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { toastError, toastSuccess } from "@/stores/toast.store";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const finish = () => router.replace(next);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await signUpWithEmail(email, password, displayName);
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      toastError("Could not create account", result.reason);
      return;
    }
    toastSuccess("Account created");
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
    toastSuccess("Welcome");
    finish();
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
        Create account
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        Save your wishlist, track orders and check out faster.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        {error ? (
          <p className="text-[13px] text-primary" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
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
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}
