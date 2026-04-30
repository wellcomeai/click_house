import { LogOut, Menu } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useUiStore } from "@/store/uiStore"
import { ROLE_LABELS } from "@/types"

export function Header() {
  const { user, logout } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const fullName =
    user?.profile?.first_name && user?.profile?.last_name
      ? `${user.profile.last_name} ${user.profile.first_name}`
      : user?.profile?.first_name
      ? user.profile.first_name
      : user?.email ?? ""

  return (
    <header
      className="glass-header sticky top-0 z-10 flex items-center justify-between h-14 px-4"
      style={{ minHeight: "56px" }}
    >
      {/* Left: burger only — no duplicate brand name */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-[#8a8a8a] hover:text-[#3d3d3d] hover:bg-[#f0faf0] transition-all duration-150"
        title={sidebarOpen ? "Скрыть меню" : "Открыть меню"}
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </button>

      {/* Right: user info + logout */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span
            className="text-sm font-semibold text-[#3d3d3d]"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {fullName}
          </span>
          <span className="text-[11px] text-[#8a8a8a]">
            {user?.role ? ROLE_LABELS[user.role] : ""}
          </span>
        </div>

        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #22b722, #1a9a1a)" }}
        >
          {user?.profile?.first_name?.charAt(0) ||
            user?.email?.charAt(0)?.toUpperCase() ||
            "U"}
        </div>

        <div className="w-px h-5 bg-[#e4e8ed]" />

        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[#8a8a8a] hover:text-red-500 hover:bg-red-50 transition-all duration-150"
          title="Выйти"
        >
          <LogOut className="h-[14px] w-[14px]" strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
