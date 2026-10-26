"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { MultiImageUploadField } from "@/components/admin/multi-image-upload-field";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Checkbox } from "@/components/ui/field";
import { RequireAdmin } from "@/components/auth/require-admin";
import {
  archiveProductAdmin,
  bulkSetProductActive,
  createProductAdmin,
  deleteProductAdmin,
  duplicateProductAdmin,
  listAllProductsAdmin,
  updateProductAdmin,
} from "@/services/admin-products.service";
import { listBrandsAdmin, listCategoriesAdmin } from "@/services/admin-catalog.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { formatPrice } from "@/lib/utils";
import { slugify } from "@/utils/string";
import type { Product } from "@/types/product";
import type { Brand, Category } from "@/types/catalog";

const emptyForm = {
  productName: "",
  slug: "",
  sku: "",
  barcode: "",
  description: "",
  price: "",
  discount: "0",
  stock: "0",
  category: "",
  categoryId: "",
  brand: "",
  brandId: "",
  thumbnail: "",
  images: [] as string[],
  seoTitle: "",
  seoDescription: "",
  featured: false,
  trending: false,
  flashSale: false,
  bestSeller: false,
  sponsored: false,
  officialStore: false,
  active: true,
};

function ProductsAdminInner() {
  const searchParams = useSearchParams();
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };

  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [products, cats, brandList] = await Promise.all([
      listAllProductsAdmin(),
      listCategoriesAdmin(),
      listBrandsAdmin(),
    ]);
    setItems(products);
    setCategories(cats);
    setBrands(brandList);
  };

  useEffect(() => {
    void reload().catch(() => setError("Could not load products."));
  }, []);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !items.length) return;
    const product = items.find((p) => p.id === editId);
    if (!product) return;
    setEditingId(product.id);
    setForm({
      productName: product.productName,
      slug: product.slug,
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      description: product.description ?? "",
      price: String(product.price ?? 0),
      discount: String(product.discount ?? 0),
      stock: String(product.stock ?? 0),
      category: product.category ?? "",
      categoryId: product.categoryId ?? "",
      brand: product.brand ?? "",
      brandId: product.brandId ?? "",
      thumbnail: product.thumbnail ?? product.images[0] ?? "",
      images: product.images ?? [],
      seoTitle: product.seoTitle ?? "",
      seoDescription: product.seoDescription ?? "",
      featured: product.featured,
      trending: product.trending,
      flashSale: product.flashSale,
      bestSeller: product.bestSeller,
      sponsored: product.sponsored,
      officialStore: product.officialStore,
      active: product.active,
    });
  }, [items, searchParams]);

  const filtered = useMemo(() => {
    let next = [...items];
    const q = query.trim().toLowerCase();
    if (q) {
      next = next.filter((p) =>
        [p.name, p.sku, p.brand, p.category, p.slug]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (filter === "active") next = next.filter((p) => p.active);
    if (filter === "inactive") next = next.filter((p) => !p.active);
    if (filter === "low") next = next.filter((p) => p.stock > 0 && p.stock <= 5);
    if (filter === "out") next = next.filter((p) => p.stock <= 0);
    if (sort === "price-asc") next.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") next.sort((a, b) => b.price - a.price);
    else if (sort === "stock") next.sort((a, b) => a.stock - b.stock);
    else if (sort === "name") next.sort((a, b) => a.name.localeCompare(b.name));
    else
      next.sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
    return next;
  }, [filter, items, query, sort]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        productName: form.productName.trim(),
        slug: (form.slug || slugify(form.productName)).trim(),
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        description: form.description,
        price: Number(form.price) || 0,
        discount: Number(form.discount) || 0,
        stock: Number(form.stock) || 0,
        category: form.category || undefined,
        categoryId: form.categoryId || undefined,
        brand: form.brand || undefined,
        brandId: form.brandId || undefined,
        thumbnail: form.thumbnail || form.images[0] || undefined,
        images: form.images,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        featured: form.featured,
        trending: form.trending,
        flashSale: form.flashSale,
        bestSeller: form.bestSeller,
        sponsored: form.sponsored,
        officialStore: form.officialStore,
        active: form.active,
      };
      if (editingId) {
        await updateProductAdmin(editingId, payload, actor);
        toastSuccess("Product updated");
      } else {
        await createProductAdmin(payload, actor);
        toastSuccess("Product created");
      }
      resetForm();
      await reload();
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : "Could not save product.";
      setError(reason);
      toastError("Save failed", reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireAdmin permission="products:write">
      <AdminPageHeader
        title="Products"
        description="Create, edit, archive and bulk-manage catalogue products."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={resetForm}>
            New product
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-line bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-ink">
            {editingId ? "Edit product" : "Create product"}
          </h2>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.productName}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  productName: e.target.value,
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={form.barcode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, barcode: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <textarea
              id="desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="min-h-[88px] w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                required
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="discount">Discount %</Label>
              <Input
                id="discount"
                type="number"
                value={form.discount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                value={form.stock}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stock: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={form.categoryId}
              onChange={(e) => {
                const cat = categories.find((c) => c.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  categoryId: e.target.value,
                  category: cat?.name ?? "",
                }));
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Select
              id="brand"
              value={form.brandId}
              onChange={(e) => {
                const brand = brands.find((b) => b.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  brandId: e.target.value,
                  brand: brand?.name ?? "",
                }));
              }}
            >
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <ImageUploadField
            label="Thumbnail"
            folder="products"
            value={form.thumbnail}
            onChange={(url) => setForm((f) => ({ ...f, thumbnail: url }))}
            idHint={form.slug || "product"}
          />
          <MultiImageUploadField
            label="Product images"
            folder="products"
            value={form.images}
            onChange={(urls) => setForm((f) => ({ ...f, images: urls }))}
            idHint={form.slug || "product"}
          />
          {!form.thumbnail && form.images.length ? (
            <p className="text-[11px] text-muted">
              No thumbnail selected — the first image will be used.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["featured", "Featured"],
                ["trending", "Trending"],
                ["flashSale", "Flash sale"],
                ["bestSeller", "Best seller"],
                ["sponsored", "Sponsored"],
                ["officialStore", "Official store"],
                ["active", "Active"],
              ] as const
            ).map(([key, label]) => (
              <Checkbox
                key={key}
                label={label}
                checked={form[key]}
                onChange={() =>
                  setForm((f) => ({ ...f, [key]: !f[key] }))
                }
              />
            ))}
          </div>
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
          {error ? (
            <p className="text-[13px] text-primary" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : editingId ? "Update product" : "Create product"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-auto"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-auto"
            >
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
              <option value="stock">Stock</option>
            </Select>
            {selected.length ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void bulkSetProductActive(selected, true, actor).then(
                      reload,
                    )
                  }
                >
                  Activate ({selected.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void bulkSetProductActive(selected, false, actor).then(
                      reload,
                    )
                  }
                >
                  Archive
                </Button>
              </>
            ) : null}
          </div>

          {!filtered.length ? (
            <AdminEmpty title="No products match" />
          ) : (
            <AdminTable
              headers={["", "Product", "Price", "Stock", "Status", "Actions"]}
            >
              {filtered.map((product) => (
                <tr key={product.id} className="text-[13px]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(product.id)}
                      onChange={() =>
                        setSelected((ids) =>
                          ids.includes(product.id)
                            ? ids.filter((id) => id !== product.id)
                            : [...ids, product.id],
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{product.name}</p>
                    <p className="text-[11px] text-muted">{product.sku}</p>
                  </td>
                  <td className="px-4 py-3">{formatPrice(product.price)}</td>
                  <td className="px-4 py-3">{product.stock}</td>
                  <td className="px-4 py-3">
                    {product.active ? "Active" : "Archived"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          setEditingId(product.id);
                          setForm({
                            productName: product.productName,
                            slug: product.slug,
                            sku: product.sku ?? "",
                            barcode: product.barcode ?? "",
                            description: product.description ?? "",
                            price: String(product.price),
                            discount: String(product.discount),
                            stock: String(product.stock),
                            category: product.category ?? "",
                            categoryId: product.categoryId ?? "",
                            brand: product.brand ?? "",
                            brandId: product.brandId ?? "",
                            thumbnail:
                              product.thumbnail ?? product.images[0] ?? "",
                            images: product.images ?? [],
                            seoTitle: product.seoTitle ?? "",
                            seoDescription: product.seoDescription ?? "",
                            featured: product.featured,
                            trending: product.trending,
                            flashSale: product.flashSale,
                            bestSeller: product.bestSeller,
                            sponsored: product.sponsored,
                            officialStore: product.officialStore,
                            active: product.active,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-muted hover:underline"
                        onClick={() =>
                          void duplicateProductAdmin(product.id, actor)
                            .then(reload)
                            .then(() => toastSuccess("Product duplicated"))
                        }
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="text-muted hover:underline"
                        onClick={() =>
                          void archiveProductAdmin(product.id, actor)
                            .then(reload)
                            .then(() => toastSuccess("Product archived"))
                        }
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete ${product.name}? This cannot be undone.`,
                            )
                          )
                            return;
                          void deleteProductAdmin(product.id, actor)
                            .then(reload)
                            .then(() => toastSuccess("Product deleted"));
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
      </div>
    </RequireAdmin>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ProductsAdminInner />
    </Suspense>
  );
}
