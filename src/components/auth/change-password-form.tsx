"use client";

import { FormEvent, useState } from "react";
import { changePassword } from "@/services/auth.service";
import { useUserStore } from "@/stores/user.store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";

export function ChangePasswordForm() {
  const user = useUserStore((state) => state.authUser);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const passwordProvider = user?.providerData.some((provider) => provider.providerId === "password");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password !== confirmation) { setMessage("New passwords do not match."); return; }
    setPending(true);
    const result = await changePassword(current, password);
    setPending(false);
    setCurrent("");
    setPassword("");
    setConfirmation("");
    setMessage(result.ok ? "Password changed successfully." : result.reason);
  }
  return (
    <Card className="mt-6">
      <h2 className="text-xl font-semibold">Change password</h2>
      <p className="mt-2 text-sm text-muted">Confirm your identity before changing your password. Google accounts will be asked to sign in again.</p>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        {passwordProvider && <div><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={(event) => setCurrent(event.target.value)} /></div>}
        <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
        {message && <p role="status">{message}</p>}
        <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Change password"}</Button>
      </form>
    </Card>
  );
}
