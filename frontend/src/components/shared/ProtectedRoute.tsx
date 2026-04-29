import { Navigate, Outlet } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/store/authStore"
import { authApi } from "@/api/auth"

export function ProtectedRoute() {
  const { isAuthenticated, accessToken, setUser } = useAuthStore()

  const { isLoading } = useQuery({
    queryKey: ["me", accessToken],
    queryFn: authApi.getMe,
    enabled: isAuthenticated(),
    staleTime: 1000 * 60 * 5,
    retry: false,
    select: (data) => {
      setUser(data)
      return data
    },
  })

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    )
  }

  return <Outlet />
}
