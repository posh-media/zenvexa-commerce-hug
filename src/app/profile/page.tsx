"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Heart,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Settings,
  Star,
} from "lucide-react";
import { serverTimestamp } from "firebase/firestore";
import { RequireAuth } from "@/components/auth/require-auth";
import { ProfileWishlistPreview } from "@/components/commerce/profile-wishlist-preview";
import { RecentlyViewedRail } from "@/components/commerce/recently-viewed";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyBoxIllustration } from "@/components/ui/illustrations";
import { Input, Label, Select } from "@/components/ui/field";
import { signOutUser, updateAuthProfile } from "@/services/auth.service";
import { listAddressesByUser } from "@/services/addresses.service";
import { listOrdersByUser } from "@/services/orders.service";
import { uploadFile } from "@/services/storage.service";
import { upsertUserProfile } from "@/services/users.service";
import { formatPrice } from "@/lib/utils";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { useUserStore } from "@/stores/user.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import type { Address } from "@/types/address";
import type { Order } from "@/types/order";

function ProfileContent() {
  const profile = useUserStore((state) => state.profile);
  const authUser = useUserStore((state) => state.authUser);
  const setProfile = useUserStore((state) => state.setProfile);
  const wishlistCount = useWishlistStore((state) => state.items.length);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? profile.display_name ?? "");
    setPhone(profile.phone ?? "");
    setDateOfBirth(profile.dateOfBirth ?? "");
    setGender(profile.gender ?? "");
  }, [profile]);

  useEffect(() => {
    const uid = authUser?.uid;
    if (!uid) return;
    let cancelled = false;
    setLoadingExtra(true);
    void Promise.all([
      listAddressesByUser(uid),
      listOrdersByUser(uid),
    ])
      .then(([addressList, orderList]) => {
        if (cancelled) return;
        setAddresses(addressList);
        setOrders(
          [...orderList].sort((a, b) => {
            const aTime =
              a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const bTime =
              b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return bTime - aTime;
          }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAddresses([]);
          setOrders([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExtra(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid]);

  const defaultAddress = useMemo(
    () =>
      addresses.find((address) => address.default) ?? addresses[0] ?? null,
    [addresses],
  );

  const memberSince = useMemo(() => {
    const raw = profile?.createdAt ?? profile?.created_time;
    if (!raw) return "—";
    const date =
      raw instanceof Date
        ? raw
        : typeof raw === "string" || typeof raw === "number"
          ? new Date(raw)
          : "toDate" in (raw as object)
            ? (raw as { toDate: () => Date }).toDate()
            : null;
    if (!date || Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-NG", {
      month: "long",
      year: "numeric",
    });
  }, [profile]);

  const initials = (displayName || profile?.email || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!authUser) return;
    if (!displayName.trim()) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const authResult = await updateAuthProfile({
        displayName: displayName.trim(),
      });
      if (!authResult.ok) {
        setError(authResult.reason);
        return;
      }
      await upsertUserProfile(authUser.uid, {
        displayName: displayName.trim(),
        display_name: displayName.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        updatedAt: serverTimestamp() as never,
      });
      setProfile({
        ...(profile ?? { id: authUser.uid }),
        id: authUser.uid,
        displayName: displayName.trim(),
        display_name: displayName.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        email: profile?.email ?? authUser.email ?? undefined,
      });
      setEditing(false);
      setMessage("Profile updated.");
      toastSuccess("Profile updated");
    } catch {
      setError("Could not save your profile. Try again.");
      toastError("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (file: File | null) => {
    if (!file || !authUser) return;
    setSaving(true);
    setError(null);
    try {
      const url = await uploadFile(
        `users/${authUser.uid}/avatar-${Date.now()}`,
        file,
      );
      await updateAuthProfile({ photoURL: url });
      await upsertUserProfile(authUser.uid, {
        photoUrl: url,
        updatedAt: serverTimestamp() as never,
      });
      setProfile({
        ...(profile ?? { id: authUser.uid }),
        id: authUser.uid,
        photoUrl: url,
      });
      setMessage("Profile photo updated.");
      toastSuccess("Profile photo updated");
    } catch {
      setError("Could not upload photo.");
      toastError("Could not upload photo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Profile" }]}
        title="Your profile"
        description="Manage your details, addresses, wishlist and orders."
        action={
          <div className="flex items-center gap-2">
            <ButtonLink href="/settings" variant="outline" size="sm">
              <Settings className="h-4 w-4" aria-hidden />
              Settings
            </ButtonLink>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void signOutUser()}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden" padded={false}>
        <div className="h-28 bg-soft sm:h-32" aria-hidden />
        <div className="flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end sm:px-6">
          <div className="relative -mt-12 shrink-0 sm:-mt-14">
            {profile?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoUrl}
                alt=""
                className="h-24 w-24 rounded-full border-4 border-white object-cover sm:h-28 sm:w-28"
              />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-ink text-2xl font-semibold text-white sm:h-28 sm:w-28">
                {initials}
              </span>
            )}
            <label className="absolute bottom-1 right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-soft">
              <Camera className="h-4 w-4" aria-hidden />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  void onPhoto(event.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                {displayName || "Shopper"}
              </h2>
              <Badge tone="neutral">
                {profile?.status ?? "active"}
              </Badge>
            </div>
            <p className="mt-1 text-[14px] text-muted">
              {profile?.email ?? authUser?.email} · Member since {memberSince}
            </p>
            {profile?.phone ? (
              <p className="mt-1 text-[13px] text-muted">{profile.phone}</p>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="sm:mb-1"
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            {editing ? "Cancel" : "Edit profile"}
          </Button>
        </div>
      </Card>

      {message ? (
        <p className="mt-4 text-[13px] text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-4 text-[13px] text-primary" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted">Orders</p>
            <Package className="h-[18px] w-[18px] text-primary" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-ink">
            {orders.length}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted">Wishlist</p>
            <Heart className="h-[18px] w-[18px] text-primary" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-ink">
            {wishlistCount}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted">Addresses</p>
            <Star className="h-[18px] w-[18px] text-primary" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-ink">
            {addresses.length}
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Personal information"
            description="Used for delivery updates and invoices."
          />
          {editing ? (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
              <div className="sm:col-span-2">
                <Label htmlFor="p-name">Full name</Label>
                <Input
                  id="p-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="p-email">Email</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={profile?.email ?? authUser?.email ?? ""}
                  disabled
                />
                <p className="mt-1 text-[12px] text-muted">
                  Email changes use Firebase Auth verification flows.
                </p>
              </div>
              <div>
                <Label htmlFor="p-phone">Phone</Label>
                <Input
                  id="p-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="p-dob">Date of birth</Label>
                <Input
                  id="p-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="p-gender">Gender</Label>
                <Select
                  id="p-gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          ) : (
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Name</dt>
                <dd className="font-medium text-ink">{displayName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Email</dt>
                <dd className="font-medium text-ink">
                  {profile?.email ?? authUser?.email ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Phone</dt>
                <dd className="font-medium text-ink">{phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Date of birth</dt>
                <dd className="font-medium text-ink">{dateOfBirth || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Gender</dt>
                <dd className="font-medium text-ink">{gender || "—"}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Saved addresses"
            description="Default address is used to speed up checkout."
            action={
              <ButtonLink href="/addresses" variant="ghost" size="sm">
                Manage
              </ButtonLink>
            }
          />
          {loadingExtra ? (
            <p className="mt-5 text-[13px] text-muted">Loading addresses…</p>
          ) : defaultAddress ? (
            <p className="mt-5 text-[14px] leading-relaxed text-muted">
              <span className="flex items-center gap-2 font-medium text-ink">
                <MapPin className="h-4 w-4 text-primary" aria-hidden />
                {defaultAddress.recipientName}
                {defaultAddress.default ? (
                  <Badge tone="neutral">Default</Badge>
                ) : null}
              </span>
              <span className="mt-2 block">
                {[
                  defaultAddress.addressLine,
                  defaultAddress.city,
                  defaultAddress.state,
                  defaultAddress.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
              <span className="mt-1 block">{defaultAddress.phone}</span>
            </p>
          ) : (
            <p className="mt-5 text-[13px] text-muted">
              No saved addresses yet.{" "}
              <Link
                href="/addresses"
                className="font-medium text-primary hover:underline"
              >
                Add one
              </Link>
            </p>
          )}
        </Card>
      </div>

      <section className="pt-16 sm:pt-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] text-ink">
            Recent orders
          </h2>
          <ButtonLink href="/orders" variant="outline" size="sm">
            All orders
          </ButtonLink>
        </div>
        {orders.length ? (
          <div className="space-y-3">
            {orders.slice(0, 3).map((order) => (
              <Card key={order.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {order.orderNumber ?? order.id}
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      {order.orderStatus ?? order.status ?? "pending"} ·{" "}
                      {formatPrice(order.total ?? 0)}
                    </p>
                  </div>
                  <ButtonLink
                    href={`/track-order?order=${encodeURIComponent(order.orderNumber ?? order.id)}`}
                    size="sm"
                    variant="outline"
                  >
                    View
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            illustration={<EmptyBoxIllustration />}
            title="No orders yet"
            description="When you place an order it will appear here."
            compact
            actions={<ButtonLink href="/products">Continue shopping</ButtonLink>}
          />
        )}
      </section>

      <section className="pt-16 sm:pt-20">
        <ProfileWishlistPreview />
      </section>

      <section className="pt-16 sm:pt-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-[-0.025em] text-ink">
          Recently viewed
        </h2>
        <RecentlyViewedRail />
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
