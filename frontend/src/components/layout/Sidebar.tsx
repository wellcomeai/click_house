import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Building2,
  CheckSquare,
  User,
  Bot,
  Users,
  X,
  HardHat,
} from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { useUiStore } from "@/store/uiStore"
import { cn } from "@/utils/cn"
import type { UserRole } from "@/types"

interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-30 transition-transform duration-300",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <HardHat className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-sm leading-tight">
              ClickHouse<br />Иркутск
            </span>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-2 space-y-1 mt-2">
          {visible.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
