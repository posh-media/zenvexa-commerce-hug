import { create } from "zustand";

export type ToastTone = "success" | "info" | "warning" | "danger";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
};

type ToastState = {
  items: ToastItem[];
};

type ToastActions = {
  push: (toast: Omit<ToastItem, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

let toastSeq = 0;

export const useToastStore = create<ToastState & ToastActions>()((set) => ({
  items: [],
  push: (toast) => {
    const id = toast.id ?? `toast-${Date.now()}-${toastSeq++}`;
    set((state) => ({
      items: [...state.items.slice(-4), { ...toast, id }],
    }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clear: () => set({ items: [] }),
}));

export function toast(
  title: string,
  options?: {
    description?: string;
    tone?: ToastTone;
    durationMs?: number;
  },
) {
  return useToastStore.getState().push({
    title,
    description: options?.description,
    tone: options?.tone ?? "info",
    durationMs: options?.durationMs ?? 4000,
  });
}

export const toastSuccess = (title: string, description?: string) =>
  toast(title, { tone: "success", description });

export const toastError = (title: string, description?: string) =>
  toast(title, { tone: "danger", description });

export const toastWarning = (title: string, description?: string) =>
  toast(title, { tone: "warning", description });

export const toastInfo = (title: string, description?: string) =>
  toast(title, { tone: "info", description });
