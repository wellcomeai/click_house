import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Building2,
  CheckSquare,
  User,
  Bot,
  Users,
  ChevronLeft,
} from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { useUiStore } from "@/store/uiStore"
import { cn } from "@/utils/cn"
import type { UserRole } from "@/types"

interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  roles: UserRole[]
}

const navItems: NavItem[] = [
  {
    path: "/dashboard",
    label: "Дашборд",
    icon: LayoutDashboard,
    roles: ["admin", "manager", "foreman", "worker"],
  },
  {
    path: "/objects",
    label: "Объекты",
    icon: Building2,
    roles: ["admin", "manager", "foreman", "worker"],
  },
  {
    path: "/tasks",
    label: "Мои задачи",
    icon: CheckSquare,
    roles: ["admin", "manager", "foreman", "worker"],
  },
  {
    path: "/agents",
    label: "AI Агенты",
    icon: Bot,
    roles: ["admin", "manager", "foreman"],
  },
  {
    path: "/admin/users",
    label: "Пользователи",
    icon: Users,
    roles: ["admin"],
  },
  {
    path: "/profile",
    label: "Профиль",
    icon: User,
    roles: ["admin", "manager", "foreman", "worker"],
  },
]

export function Sidebar() {
  const { user } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const role = user?.role

  const visible = navItems.filter((item) => role && item.roles.includes(role))

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          style={{ backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "flex-shrink-0 overflow-hidden sidebar-transition",
          "lg:relative lg:z-auto",
          "fixed top-0 left-0 h-full z-30 lg:static lg:h-auto",
          sidebarOpen ? "w-[268px]" : "w-0 lg:w-0"
        )}
      >
        <div
          className="glass-sidebar h-full w-[268px] flex flex-col overflow-hidden"
          style={{
            boxShadow: sidebarOpen
              ? "4px 0 24px rgba(0,0,0,0.07)"
              : "none",
          }}
        >
          {/* Logo area — bigger image, clear close button */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            {/* Logo: tall enough to be readable */}
            <img
              src="/logotip.jpg"
              alt="Clickhome"
              className="object-contain"
              style={{ height: "48px", width: "auto", maxWidth: "180px" }}
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = "none"
                const fallback = target.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = "flex"
              }}
            />
            {/* Fallback text logo (hidden by default, shown if image fails) */}
            <div
              className="items-center gap-2"
              style={{ display: "none" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #22b722, #1a9a1a)" }}
              >
                CH
              </div>
              <span
                className="text-base font-bold text-[#3d3d3d]"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Clickhome
              </span>
            </div>

            {/* Close arrow */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#8a8a8a] hover:text-[#3d3d3d] hover:bg-[#f0faf0] transition-all duration-150 flex-shrink-0 ml-2"
              title="Свернуть меню"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-4 h-px bg-[#e4e8ed] mb-2" />

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {visible.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false)
                }}
                className={({ isActive }) =>
                  cn(
                    "nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap",
                    isActive
                      ? "nav-active font-semibold"
                      : "text-[#5a5a5a] hover:text-[#3d3d3d]"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        "flex-shrink-0",
                        isActive ? "text-[#22b722]" : "text-[#8a8a8a]"
                      )}
                      style={{ width: "16px", height: "16px" }}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <span style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#22b722] flex-shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom user badge */}
          <div className="p-4 mt-auto">
            <div className="h-px bg-[#e4e8ed] mb-3" />
            <div className="flex items-center gap-2.5 px-1">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #22b722, #1a9a1a)" }}
              >
                {user?.profile?.first_name?.charAt(0) ||
                  user?.email?.charAt(0)?.toUpperCase() ||
                  "U"}
              </div>
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold text-[#3d3d3d] truncate leading-tight"
                >
                  {user?.profile?.first_name
                    ? `${user.profile.last_name ?? ""} ${user.profile.first_name}`.trim()
                    : user?.email ?? ""}
                </p>
                <p className="text-[10px] text-[#8a8a8a] leading-tight capitalize">
                  {user?.role ?? ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
