import apiClient from "./client"

export interface TaskComment {
  id: string
  task_id: string
  author_id: string | null
  author_name: string | null
  text: string
  created_at: string
  updated_at: string
}

export const taskCommentsApi = {
  getByTask: (taskId: string) =>
    apiClient.get<TaskComment[]>(`/tasks/${taskId}/comments`).then((r) => r.data),

  create: (taskId: string, text: string) =>
    apiClient.post<TaskComment>(`/tasks/${taskId}/comments`, { text }).then((r) => r.data),

  update: (taskId: string, commentId: string, text: string) =>
    apiClient
      .put<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { text })
      .then((r) => r.data),

  delete: (taskId: string, commentId: string) =>
    apiClient.delete(`/tasks/${taskId}/comments/${commentId}`),
}
