"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/field";
import {
  createCategoryAdmin,
  deleteCategoryAdmin,
  listCategoriesAdmin,
  updateCategoryAdmin,
} from "@/services/admin-catalog.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { slugify } from "@/utils/string";
import type { Category } from "@/types/catalog";

export default function AdminCategoriesPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  const [items, setItems] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    image: "",
    featured: false,
    active: true,
    seoTitle: "",
    seoDescription: "",
  });

  const reload = () =>
    listCategoriesAdmin().then(setItems).catch(() => undefined);

  useEffect(() => {
    void reload();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id) return;
    try {
      const payload = {
        name: form.name.trim(),
        slug: (form.slug || slugify(form.name)).trim(),
        description: form.description || undefined,
        image: form.image || undefined,
        featured: form.featured,
        active: form.active,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
      };
      if (editingId) {
        await updateCategoryAdmin(editingId, payload, actor);
        toastSuccess("Category updated");
      } else {
        await createCategoryAdmin(payload, actor);
        toastSuccess("Category created");
      }
      setEditingId(null);
      setForm({
        name: "",
        slug: "",
        description: "",
        image: "",
        featured: false,
        active: true,
        seoTitle: "",
        seoDescription: "",
      });
      await reload();
    } catch (err) {
      toastError(
        "Save failed",
        err instanceof Error ? err.message : "Could not save category.",
      );
    }
  };

  return (
    <RequireAdmin permission="categories:write">
      <AdminPageHeader
        title="Categories"
        description="Manage storefront categories, featured flags and SEO."
      />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-line bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-ink">
            {editingId ? "Edit category" : "Create category"}
          </h2>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <ImageUploadField
            label="Image"
            folder="categories"
            value={form.image}
            onChange={(url) => setForm((f) => ({ ...f, image: url }))}
          />
          <Checkbox
            label="Featured"
            checked={form.featured}
            onChange={() => setForm((f) => ({ ...f, featured: !f.featured }))}
          />
          <Checkbox
            label="Active"
            checked={form.active}
            onChange={() => setForm((f) => ({ ...f, active: !f.active }))}
          />
          <div>
            <Label htmlFor="seoTitle">SEO title</Label>
            <Input
              id="seoTitle"
              value={form.seoTitle}
              onChange={(e) =>
                setForm((f) => ({ ...f, seoTitle: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="seoDesc">SEO description</Label>
            <Input
              id="seoDesc"
              value={form.seoDescription}
              onChange={(e) =>
                setForm((f) => ({ ...f, seoDescription: e.target.value }))
              }
            />
          </div>
          <Button type="submit" className="w-full">
            {editingId ? "Update" : "Create"}
          </Button>
        </form>

        {!items.length ? (
          <AdminEmpty title="No categories yet" />
        ) : (
          <AdminTable headers={["Name", "Products", "Flags", "Actions"]}>
            {items.map((item) => (
              <tr key={item.id} className="text-[13px]">
                <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                <td className="px-4 py-3 text-muted">
                  {item.productCount ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {[item.featured ? "Featured" : null, item.active === false ? "Inactive" : "Active"]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          slug: item.slug,
                          description: item.description ?? "",
                          image: item.image ?? "",
                          featured: Boolean(item.featured),
                          active: item.active !== false,
                          seoTitle: item.seoTitle ?? "",
                          seoDescription: item.seoDescription ?? "",
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-muted hover:underline"
                      onClick={() =>
                        void updateCategoryAdmin(
                          item.id,
                          { active: item.active === false },
                          actor,
                        ).then(reload)
                      }
                    >
                      {item.active === false ? "Activate" : "Deactivate"}
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        if (!window.confirm(`Delete ${item.name}?`)) return;
                        void deleteCategoryAdmin(item.id, actor).then(reload);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </div>
    </RequireAdmin>
  );
}
