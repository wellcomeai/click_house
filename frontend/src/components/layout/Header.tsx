import { Menu, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useUiStore } from "@/store/uiStore"
import { Button } from "@/components/ui/button"
import { ROLE_LABELS } from "@/types"

export function Header() {
  const { user, logout } = useAuthStore()
  const { toggleSidebar } = useUiStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const fullName =
    user?.profile?.first_name && user?.profile?.last_name
      ? `${user.profile.last_name} ${user.profile.first_name}`
      : user?.email ?? ""

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-white border-b shadow-sm">
      <button
        className="p-2 rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-900">{fullName}</p>
          <p className="text-xs text-slate-500">
            {user?.role ? ROLE_LABELS[user.role] : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Выйти"
        >
          <LogOut className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
    </header>
  )
}
