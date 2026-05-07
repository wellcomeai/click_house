import apiClient from "./client"
import { useAuthStore } from "@/store/authStore"

const BASE_URL = import.meta.env.VITE_API_URL || ""

export interface AssistantNote {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface AssistantNoteDetail extends AssistantNote {
  content: string
}

export interface KBFile {
  id: string
  original_name: string
  public_url: string
  file_type: string
  size_bytes: number
  status: "processing" | "indexed" | "error"
  error_message: string | null
  created_at: string
}

export interface ChunkPreview {
  id: number
  source_type: string
  source_name: string
  chunk_index: number
  chunk_text_preview: string
  created_at: string
}

export interface KBStats {
  notes_count: number
  files_count: number
  chunks_count: number
  total_size_bytes: number
}

export interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  last_message: string | null
  message_count: number
}

export interface ChatHistoryItem {
  id: number
  role: "user" | "assistant"
  content: string
  created_at: string
}

export interface SourceItem {
  source_type: string
  source_name: string
  chunk_index: number
  similarity: number
  excerpt: string
}

export const assistantApi = {
  // Notes
  createNote: (title: string, content: string) =>
    apiClient.post<AssistantNoteDetail>("/assistant/notes", { title, content }).then((r) => r.data),

  listNotes: () =>
    apiClient.get<AssistantNote[]>("/assistant/notes").then((r) => r.data),

  getNote: (id: string) =>
    apiClient.get<AssistantNoteDetail>(`/assistant/notes/${id}`).then((r) => r.data),

  updateNote: (id: string, title?: string, content?: string) =>
    apiClient
      .put<AssistantNoteDetail>(`/assistant/notes/${id}`, { title, content })
      .then((r) => r.data),

  deleteNote: (id: string) => apiClient.delete(`/assistant/notes/${id}`),

  // Files
  uploadFile: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return apiClient
      .post<KBFile>("/assistant/files", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data)
  },

  listFiles: () => apiClient.get<KBFile[]>("/assistant/files").then((r) => r.data),

  deleteFile: (id: string) => apiClient.delete(`/assistant/files/${id}`),

  // Chunks
  listChunks: (sourceType: "all" | "note" | "file" = "all") =>
    apiClient
      .get<ChunkPreview[]>(`/assistant/chunks?source_type=${sourceType}`)
      .then((r) => r.data),

  // Stats
  getStats: () => apiClient.get<KBStats>("/assistant/stats").then((r) => r.data),

  // Sessions
  createSession: (title?: string) =>
    apiClient
      .post<ChatSession>("/assistant/sessions", { title: title || "Новый чат" })
      .then((r) => r.data),

  listSessions: () =>
    apiClient.get<ChatSession[]>("/assistant/sessions").then((r) => r.data),

  renameSession: (id: string, title: string) =>
    apiClient.put<ChatSession>(`/assistant/sessions/${id}`, { title }).then((r) => r.data),

  deleteSession: (id: string) => apiClient.delete(`/assistant/sessions/${id}`),

  // Chat history
  getChatHistory: (sessionId: string, limit = 50) =>
    apiClient
      .get<ChatHistoryItem[]>(`/assistant/chat/history?session_id=${sessionId}&limit=${limit}`)
      .then((r) => r.data),

  clearChatHistory: () => apiClient.delete("/assistant/chat/history"),

  // Streaming chat — native fetch for SSE
  streamChat: async (
    message: string,
    sessionId: string | null,
    onText: (chunk: string) => void,
    onSources: (sources: SourceItem[]) => void,
    onSessionId: (sessionId: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
  ) => {
    const token = useAuthStore.getState().accessToken
    let response: Response
    try {
      response = await fetch(`${BASE_URL}/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, session_id: sessionId }),
      })
    } catch (e) {
      onError("Ошибка сети")
      return
    }

    if (!response.ok) {
      onError(`Ошибка ${response.status}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError("Стриминг недоступен")
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") {
          onDone()
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === "session_id") onSessionId(parsed.session_id)
          else if (parsed.type === "text") onText(parsed.content)
          else if (parsed.type === "sources") onSources(parsed.sources)
          else if (parsed.type === "error") {
            onError(parsed.content)
            return
          }
        } catch {
          // skip malformed
        }
      }
    }
    onDone()
  },
}
