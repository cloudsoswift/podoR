import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  email: string;
  nickname: string;
  profileImage: string | null;
  role?: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ accessToken: null, user: null }),
    }),
    { name: "auth-storage" }
  )
);
