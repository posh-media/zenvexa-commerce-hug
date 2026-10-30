import type { Product } from "@/lib/data";

type CatalogCategory = { id: string; name: string; slug: string };

export function categorySections(items: Product[], categories: CatalogCategory[]) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const aliases = new Map<string, CatalogCategory | null>();
  for (const category of categories) {
    for (const value of [category.name, category.slug]) {
      const key = normalize(value);
      const previous = aliases.get(key);
      aliases.set(key, previous && previous.id !== category.id ? null : previous === null ? null : category);
    }
  }
  const byId = new Map(categories.map((category) => [category.id, category]));
  const sections = new Map<string, { id: string; name: string; items: Product[] }>();
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const category = byId.get(item.categoryId ?? "") ?? aliases.get(normalize(item.category ?? ""));
    const id = category?.id ?? "__other";
    if (!sections.has(id)) sections.set(id, { id, name: category?.name ?? "Other", items: [] });
    sections.get(id)!.items.push(item);
  }
  return [...sections.values()];
}
