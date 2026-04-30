import apiClient from "./client"
import type { ObjectFile } from "@/types"

export const filesApi = {
  getByObject: (objectId: string) =>
    apiClient.get<ObjectFile[]>(`/objects/${objectId}/files`).then((r) => r.data),

  uploadToObject: (objectId: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return apiClient
      .post<ObjectFile>(`/objects/${objectId}/files`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data)
  },

  deleteFromObject: (objectId: string, fileId: string) =>
    apiClient.delete(`/objects/${objectId}/files/${fileId}`),

  getByTask: (taskId: string) =>
    apiClient.get<ObjectFile[]>(`/tasks/${taskId}/files`).then((r) => r.data),

  uploadToTask: (taskId: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return apiClient
      .post<ObjectFile>(`/tasks/${taskId}/files`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data)
  },
}
