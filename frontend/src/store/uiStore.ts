import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UiState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

// Default: open on desktop, check window width
const defaultSidebarOpen = typeof window !== "undefined" ? window.innerWidth >= 1024 : true

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: defaultSidebarOpen,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "ch-ui",
    }
  )
)
