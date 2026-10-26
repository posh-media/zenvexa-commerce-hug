import { create } from "zustand";
import type { AppNotification } from "@/types/commerce";

type NotificationsState = {
  items: AppNotification[];
  unreadCount: number;
};

type NotificationsActions = {
  setItems: (items: AppNotification[]) => void;
  setUnreadCount: (unreadCount: number) => void;
  reset: () => void;
};

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
};

export const useNotificationsStore = create<
  NotificationsState & NotificationsActions
>()((set) => ({
  ...initialState,
  setItems: (items) => set({ items }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  reset: () => set(initialState),
}));
