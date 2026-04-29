import apiClient from "./client"
import type { Task, TaskPriority, TaskStatus, TaskCategory } from "@/types"

export const tasksApi = {
  getMyTasks: () => apiClient.get<Task[]>("/tasks/").then((r) => r.data),

  getAllTasks: () => apiClient.get<Task[]>("/tasks/all").then((r) => r.data),

  getByObject: (objectId: string) =>
    apiClient.get<Task[]>(`/tasks/object/${objectId}`).then((r) => r.data),

  getById: (id: string) => apiClient.get<Task>(`/tasks/${id}`).then((r) => r.data),

  create: (data: {
    title: string
    description?: string
    priority?: TaskPriority
    category?: TaskCategory
    object_id?: string
    assignee_id?: string
    deadline?: string
  }) => apiClient.post<Task>("/tasks/", data).then((r) => r.data),

  update: (id: string, data: Partial<Task>) =>
    apiClient.put<Task>(`/tasks/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: TaskStatus) =>
    apiClient.patch<Task>(`/tasks/${id}/status`, { status }).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/tasks/${id}`),

  addChecklist: (taskId: string, title: string) =>
    apiClient.post<Task>(`/tasks/${taskId}/checklist`, { title }).then((r) => r.data),

  toggleChecklist: (taskId: string, itemId: string, is_done: boolean) =>
    apiClient
      .patch<Task>(`/tasks/${taskId}/checklist/${itemId}`, { is_done })
      .then((r) => r.data),
}
