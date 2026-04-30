import apiClient from "./client"
import type { ObjectComment } from "@/types"

export const commentsApi = {
  getByObject: (objectId: string) =>
    apiClient.get<ObjectComment[]>(`/objects/${objectId}/comments`).then((r) => r.data),

  create: (objectId: string, text: string) =>
    apiClient
      .post<ObjectComment>(`/objects/${objectId}/comments`, { text })
      .then((r) => r.data),

  update: (objectId: string, commentId: string, text: string) =>
    apiClient
      .put<ObjectComment>(`/objects/${objectId}/comments/${commentId}`, { text })
      .then((r) => r.data),

  delete: (objectId: string, commentId: string) =>
    apiClient.delete(`/objects/${objectId}/comments/${commentId}`),
}
