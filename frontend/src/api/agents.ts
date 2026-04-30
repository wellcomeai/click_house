import apiClient from "./client"
import type { Agent } from "@/types"
import { useAuthStore } from "@/store/authStore"

const BASE_URL = import.meta.env.VITE_API_URL || ""

export const agentsApi = {
  getAll: () => apiClient.get<{ agents: Agent[] }>("/agents/").then((r) => r.data.agents),

  streamRun: async (
    agentName: string,
    message: string,
    history: Array<{ role: string; content: string }>,
    objectId: string | null,
    onChunk: (type: string, content: string) => void,
    onDone: () => void,
    onError: (error: string) => void
  ) => {
    const token = useAuthStore.getState().accessToken
    const response = await fetch(`${BASE_URL}/agents/${agentName}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, history, object_id: objectId }),
    })

    if (!response.ok) {
      onError(`Ошибка ${response.status}: ${response.statusText}`)
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
          if (parsed.type === "text" && parsed.content) {
            onChunk("text", parsed.content)
          } else if (parsed.type === "tool_call" && parsed.tool) {
            onChunk("tool_call", parsed.tool)
          } else if (parsed.type === "error") {
            onError(parsed.content)
            return
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    onDone()
  },
}
