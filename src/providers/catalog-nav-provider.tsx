"use client";

import { createContext, useContext } from "react";
import type { Brand, Category } from "@/lib/data";

type CatalogNavValue = {
  categories: Category[];
  brands: Brand[];
  popularSearches: string[];
};

const CatalogNavContext = createContext<CatalogNavValue>({
  categories: [],
  brands: [],
  popularSearches: [],
});

export function CatalogNavProvider({
  value,
  children,
}: {
  value: CatalogNavValue;
  children: React.ReactNode;
}) {
  return (
    <CatalogNavContext.Provider value={value}>
      {children}
    </CatalogNavContext.Provider>
  );
}

export function useCatalogNav() {
  return useContext(CatalogNavContext);
}
