import { create } from "zustand";
import {
  readJsonStorage,
  writeJsonStorage,
} from "@/lib/cart";

const SEARCH_HISTORY_KEY = "shopbeta.search-history.v1";
const MAX_RECENT = 10;

type SearchFilters = {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: "relevance" | "price-asc" | "price-desc" | "rating" | "newest";
};

type SearchState = {
  term: string;
  filters: SearchFilters;
  recent: string[];
  hydrated: boolean;
};

type SearchActions = {
  hydrate: () => void;
  setTerm: (term: string) => void;
  setFilters: (filters: SearchFilters) => void;
  pushRecent: (term: string) => void;
  removeRecent: (term: string) => void;
  clearRecent: () => void;
  mergeRemote: (terms: string[]) => void;
  setRecent: (recent: string[]) => void;
  reset: () => void;
};

function persist(recent: string[]) {
  writeJsonStorage(SEARCH_HISTORY_KEY, recent);
}

const initialState: SearchState = {
  term: "",
  filters: {},
  recent: [],
  hydrated: false,
};

export const useSearchStore = create<SearchState & SearchActions>()((set, get) => ({
  ...initialState,
  hydrate: () => {
    if (get().hydrated) return;
    const recent = readJsonStorage<string[]>(SEARCH_HISTORY_KEY, []);
    set({
      recent: Array.isArray(recent) ? recent : [],
      hydrated: true,
    });
  },
  setTerm: (term) => set({ term }),
  setFilters: (filters) => set({ filters }),
  pushRecent: (term) => {
    const normalized = term.trim();
    if (!normalized) return;
    const recent = [
      normalized,
      ...get().recent.filter(
        (item) => item.toLowerCase() !== normalized.toLowerCase(),
      ),
    ].slice(0, MAX_RECENT);
    persist(recent);
    set({ recent });
  },
  removeRecent: (term) => {
    const recent = get().recent.filter(
      (item) => item.toLowerCase() !== term.trim().toLowerCase(),
    );
    persist(recent);
    set({ recent });
  },
  clearRecent: () => {
    persist([]);
    set({ recent: [] });
  },
  mergeRemote: (terms) => {
    const recent = [
      ...terms,
      ...get().recent,
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      .filter(
        (item, index, all) =>
          all.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) ===
          index,
      )
      .slice(0, MAX_RECENT);
    persist(recent);
    set({ recent, hydrated: true });
  },
  setRecent: (recent) => {
    persist(recent);
    set({ recent });
  },
  reset: () => set(initialState),
}));
