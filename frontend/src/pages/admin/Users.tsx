import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { usersApi } from "@/api/users"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ROLE_LABELS, type UserRole } from "@/types"
import { useAuthStore } from "@/store/authStore"

const ROLES: UserRole[] = ["admin", "manager", "foreman", "worker"]

export function AdminUsers() {
  const { user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  })

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersApi.updateRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Управление пользователями</h1>

      {isLoading ? (
        <p className="text-slate-400">Загрузка...</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const fullName =
              user.profile?.first_name
                ? `${user.profile?.last_name ?? ""} ${user.profile.first_name}`.trim()
                : user.email

            return (
              <Card key={user.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-slate-800">{fullName}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                    {user.profile?.position && (
                      <p className="text-xs text-slate-400">{user.profile.position}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.is_active ? "success" : "destructive"}>
                      {user.is_active ? "Активен" : "Заблокирован"}
                    </Badge>
                    <Select
                      value={user.role}
                      disabled={user.id === currentUser?.id}
                      onValueChange={(role) =>
                        updateRole.mutate({ id: user.id, role: role as UserRole })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
