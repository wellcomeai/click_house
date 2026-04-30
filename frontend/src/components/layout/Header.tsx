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
      {/* Left: burger */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[#8a8a8a] hover:text-[#3d3d3d] hover:bg-[#f0faf0] transition-all duration-150"
          title={sidebarOpen ? "Скрыть меню" : "Открыть меню"}
        >
          <Menu className="h-4.5 w-4.5" strokeWidth={1.9} />
        </button>

        {/* Page context — breadcrumb placeholder */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className="text-[11px] font-medium tracking-widest uppercase text-[#22b722] select-none"
            style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "0.12em" }}
          >
            Clickhome
          </span>
          <span className="text-[#e4e8ed] text-sm">·</span>
          <span className="text-[12px] text-[#8a8a8a] font-medium">
            Иркутск
          </span>
        </div>
      </div>

      {/* Right: user info + logout */}
      <div className="flex items-center gap-3">
        {/* User info */}
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

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #22b722, #1a9a1a)" }}
        >
          {user?.profile?.first_name?.charAt(0) ||
            user?.email?.charAt(0)?.toUpperCase() ||
            "U"}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[#e4e8ed]" />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[#8a8a8a] hover:text-red-500 hover:bg-red-50 transition-all duration-150"
          title="Выйти"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
