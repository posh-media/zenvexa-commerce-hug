import { create } from "zustand";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/types/user";

type UserState = {
  authUser: User | null;
  profile: UserProfile | null;
  status: "loading" | "authenticated" | "anonymous";
};

type UserActions = {
  setAuthUser: (authUser: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: UserState["status"]) => void;
  reset: () => void;
};

const initialState: UserState = {
  authUser: null,
  profile: null,
  status: "loading",
};

export const useUserStore = create<UserState & UserActions>()((set) => ({
  ...initialState,
  setAuthUser: (authUser) => set({ authUser }),
  setProfile: (profile) => set({ profile }),
  setStatus: (status) => set({ status }),
  reset: () => set(initialState),
}));
