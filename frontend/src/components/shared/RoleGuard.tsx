import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import type { UserRole } from "@/types"

interface RoleGuardProps {
  roles: UserRole[]
}

export function RoleGuard({ roles }: RoleGuardProps) {
  const { user } = useAuthStore()

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
