import apiClient from "./client"
import type { User, UserRole } from "@/types"

export const usersApi = {
  getAll: () => apiClient.get<User[]>("/users/").then((r) => r.data),

  getById: (id: string) => apiClient.get<User>(`/users/${id}`).then((r) => r.data),

  updateProfile: (
    id: string,
    data: {
      first_name?: string
      last_name?: string
      middle_name?: string
      position?: string
      phone?: string
    }
  ) => apiClient.put<User>(`/users/${id}`, data).then((r) => r.data),

  updateRole: (id: string, role: UserRole) =>
    apiClient.patch<User>(`/users/${id}/role`, { role }).then((r) => r.data),
}
