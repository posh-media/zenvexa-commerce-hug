"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { serverTimestamp } from "firebase/firestore";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyBoxIllustration } from "@/components/ui/illustrations";
import { Input, Label, Select } from "@/components/ui/field";
import {
  createAddress,
  deleteAddress,
  listAddressesByUser,
  setDefaultAddress,
  updateAddress,
} from "@/services/addresses.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import type { Address, AddressDocument } from "@/types/address";

const emptyForm = {
  recipientName: "",
  phone: "",
  country: "Nigeria",
  state: "",
  city: "",
  addressLine: "",
  postalCode: "",
  landmark: "",
  default: false,
};

function AddressesContent() {
  const uid = useUserStore((state) => state.authUser?.uid);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      setAddresses(await listAddressesByUser(uid));
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const startCreate = () => {
    setEditingId("new");
    setForm({ ...emptyForm, default: addresses.length === 0 });
    setError(null);
  };

  const startEdit = (address: Address) => {
    setEditingId(address.id);
    setForm({
      recipientName: address.recipientName,
      phone: address.phone,
      country: address.country,
      state: address.state,
      city: address.city,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
      landmark: address.landmark ?? "",
      default: Boolean(address.default),
    });
    setError(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!uid) return;
    if (
      !form.recipientName.trim() ||
      !form.phone.trim() ||
      !form.addressLine.trim() ||
      !form.city.trim() ||
      !form.country.trim()
    ) {
      setError("Recipient, phone, address line, city and country are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: AddressDocument = {
      userId: uid,
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      country: form.country.trim(),
      state: form.state.trim(),
      city: form.city.trim(),
      addressLine: form.addressLine.trim(),
      postalCode: form.postalCode.trim(),
      landmark: form.landmark.trim() || undefined,
      default: form.default,
      updatedAt: serverTimestamp() as never,
    };
    try {
      const creating = editingId === "new";
      if (creating) {
        await createAddress({
          ...payload,
          createdAt: serverTimestamp() as never,
        });
      } else if (editingId) {
        await updateAddress(editingId, payload);
      }
      setEditingId(null);
      setForm(emptyForm);
      await reload();
      toastSuccess(creating ? "Address added" : "Address updated");
    } catch {
      setError("Could not save address.");
      toastError("Could not save address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Profile", href: "/profile" },
          { label: "Addresses" },
        ]}
        title="Saved addresses"
        description="Manage delivery addresses for faster checkout."
        action={
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add address
          </Button>
        }
      />

      {editingId ? (
        <Card className="mb-6">
          <h2 className="text-[15px] font-semibold text-ink">
            {editingId === "new" ? "New address" : "Edit address"}
          </h2>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="recipient">Recipient name</Label>
              <Input
                id="recipient"
                value={form.recipientName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recipientName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="line">Address line</Label>
              <Input
                id="line"
                value={form.addressLine}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    addressLine: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="landmark">Landmark</Label>
              <Input
                id="landmark"
                value={form.landmark}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    landmark: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="postal">Postal code</Label>
              <Input
                id="postal"
                value={form.postalCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    postalCode: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({ ...current, city: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(event) =>
                  setForm((current) => ({ ...current, state: event.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="country">Country</Label>
              <Select
                id="country"
                value={form.country}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    country: event.target.value,
                  }))
                }
              >
                <option>Nigeria</option>
                <option>Ghana</option>
                <option>Kenya</option>
                <option>United Kingdom</option>
                <option>United States</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
              <input
                type="checkbox"
                checked={form.default}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    default: event.target.checked,
                  }))
                }
              />
              Set as default address
            </label>
            {error ? (
              <p className="text-[13px] text-primary sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save address"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading addresses…</p>
      ) : !addresses.length ? (
        <EmptyState
          illustration={<EmptyBoxIllustration />}
          title="No addresses yet"
          description="Add a delivery address to speed up checkout."
          actions={
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Add address
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {addresses.map((address) => (
            <Card key={address.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink">
                      {address.recipientName}
                    </p>
                    {address.default ? <Badge tone="neutral">Default</Badge> : null}
                  </div>
                  <p className="mt-2 text-[14px] text-muted">
                    {[
                      address.addressLine,
                      address.landmark,
                      address.city,
                      address.state,
                      address.postalCode,
                      address.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{address.phone}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!address.default && uid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                      void setDefaultAddress(uid, address.id).then(() => {
                        toastSuccess("Default address updated");
                        return reload();
                      })
                    }
                    >
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(address)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      void deleteAddress(address.id).then(() => {
                        toastSuccess("Address removed");
                        return reload();
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddressesPage() {
  return (
    <RequireAuth>
      <AddressesContent />
    </RequireAuth>
  );
}
