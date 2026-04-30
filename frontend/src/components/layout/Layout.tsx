import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--ch-bg)" }}>
      {/* Sidebar — width animates 268px ↔ 0px in flex context */}
      <Sidebar />

      {/* Main area — grows to fill remaining width */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
