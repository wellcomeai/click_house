import apiClient from "./client"
import type { ConstructionObject, ObjectStatus, ObjectType } from "@/types"

export const objectsApi = {
  getAll: () => apiClient.get<ConstructionObject[]>("/objects/").then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ConstructionObject>(`/objects/${id}`).then((r) => r.data),

  create: (data: {
    name: string
    address?: string
    object_type?: ObjectType
    status?: ObjectStatus
    description?: string
    manager_id?: string
    foreman_id?: string
  }) => apiClient.post<ConstructionObject>("/objects/", data).then((r) => r.data),

  update: (id: string, data: Partial<ConstructionObject>) =>
    apiClient.put<ConstructionObject>(`/objects/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/objects/${id}`),

  getSummary: (id: string) => apiClient.get(`/objects/${id}/summary`).then((r) => r.data),
}
