import { useState, useRef, useEffect } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Send, Bot, User, Loader2, Wrench, Building2, X, Paperclip, ImageIcon } from "lucide-react"
import { agentsApi } from "@/api/agents"
import { objectsApi } from "@/api/objects"
import { filesApi } from "@/api/files"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Agent, ChatMessage } from "@/types"

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-blue-600" : "bg-slate-700"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>
      <div className="max-w-[80%] flex flex-col gap-2">
        {(msg.content || (msg.isStreaming && !msg.images?.length)) && (
          <div
            className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? "bg-blue-600 text-white"
                : "bg-white border text-slate-800 shadow-sm"
            }`}
          >
            {msg.isStreaming && !msg.content ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
            )}
          </div>
        )}
        {msg.images?.map((url, i) => (
          <div key={i} className="rounded-xl overflow-hidden border shadow-sm">
            <img src={url} alt="" style={{ maxHeight: 480, display: "block", width: "100%" }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentChat() {
  const { name: agentNameParam } = useParams<{ name?: string }>()

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: agentsApi.getAll,
  })

  const { data: objects = [] } = useQuery({
    queryKey: ["objects"],
    queryFn: objectsApi.getAll,
  })

  const [selectedAgent, setSelectedAgent] = useState<string>(agentNameParam ?? "")
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTool, setCurrentTool] = useState<string | null>(null)

  // Image upload state
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedAgent && agents.length > 0) {
      setSelectedAgent(agents[0].name)
    }
  }, [agents, selectedAgent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const selectedObject = objects.find((o) => o.id === selectedObjectId)

  const clearImage = () => {
    setImagePreviewUrl(null)
    setUploadedFileUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setImagePreviewUrl(preview)
    setUploadedFileUrl(null)

    if (selectedObjectId) {
      setIsUploading(true)
      try {
        const uploaded = await filesApi.uploadToObject(selectedObjectId, file)
        setUploadedFileUrl(uploaded.public_url)
      } catch {
        // Keep preview, but no server URL
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !selectedAgent || isStreaming) return

    const filesUrl = uploadedFileUrl ?? null

    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    setIsStreaming(true)
    setCurrentTool(null)
    clearImage()

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const userMsg: ChatMessage = { role: "user", content: text }
    const assistantMsg: ChatMessage = { role: "assistant", content: "", isStreaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    await agentsApi.streamRun(
      selectedAgent,
      text,
      history,
      selectedObjectId,
      (type, content) => {
        if (type === "text") {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + content,
                isStreaming: true,
              }
            }
            return updated
          })
        } else if (type === "tool_call") {
          setCurrentTool(content)
        } else if (type === "image") {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                images: [...(last.images ?? []), content],
              }
            }
            return updated
          })
        }
      },
      () => {
        setIsStreaming(false)
        setCurrentTool(null)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false }
          }
          return updated
        })
      },
      (error) => {
        setIsStreaming(false)
        setCurrentTool(null)
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `Ошибка: ${error}` },
        ])
      },
      filesUrl
    )
  }

  const agentInfo: Agent | undefined = agents.find((a) => a.name === selectedAgent)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">

      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">AI Агенты</h1>
      </div>

      {/* Выбор агента */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {agentsLoading ? (
          <p className="text-slate-400 text-sm">Загрузка агентов...</p>
        ) : (
          agents.map((agent) => (
            <Button
              key={agent.name}
              variant={selectedAgent === agent.name ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedAgent(agent.name)
                setMessages([])
              }}
            >
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              {agent.display_name}
            </Button>
          ))
        )}
      </div>

      {agentInfo && (
        <p className="text-sm text-slate-500 mb-3">{agentInfo.description}</p>
      )}

      {/* Область сообщений */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Bot className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Начните диалог с агентом</p>
            {objects.length > 0 && (
              <p className="text-xs mt-1 text-slate-300">
                Выберите объект внизу для анализа конкретного объекта
              </p>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {currentTool && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-11">
            <Wrench className="h-3.5 w-3.5 animate-pulse" />
            Использую инструмент: {currentTool}
          </div>
        )}
        <div ref={bottomRef} />
      </Card>

      {/* Нижняя панель */}
      <div className="mt-3 space-y-2">

        {/* Строка выбора объекта */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />

          <select
            value={selectedObjectId ?? ""}
            onChange={(e) => setSelectedObjectId(e.target.value || null)}
            className="flex-1 h-8 rounded-md border border-input bg-white px-2 py-1
                       text-xs text-slate-600 focus-visible:outline-none
                       focus-visible:ring-1 focus-visible:ring-ring max-w-xs"
          >
            <option value="">— Объект не выбран —</option>
            {objects.map((obj) => (
              <option key={obj.id} value={obj.id}>
                {obj.name}
              </option>
            ))}
          </select>

          {selectedObject && (
            <div className="flex items-center gap-1.5 px-2.5 py-1
                            bg-green-50 border border-green-200
                            rounded-full text-xs text-green-700 font-medium
                            max-w-[280px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="truncate">{selectedObject.name}</span>
              <button
                onClick={() => setSelectedObjectId(null)}
                className="ml-0.5 text-green-400 hover:text-green-700 flex-shrink-0
                           transition-colors"
                title="Снять выбор объекта"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Превью изображения */}
        {imagePreviewUrl && (
          <div className="flex items-center gap-2">
            <div className="relative inline-flex">
              <img
                src={imagePreviewUrl}
                alt="preview"
                className="h-16 w-16 object-cover rounded-md border"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center
                                bg-black/40 rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              <button
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full
                           bg-slate-700 text-white flex items-center justify-center
                           hover:bg-slate-900"
                title="Удалить изображение"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
            {uploadedFileUrl ? (
              <span className="text-xs text-green-600">Загружено</span>
            ) : isUploading ? (
              <span className="text-xs text-slate-400">Загрузка...</span>
            ) : (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {selectedObjectId
                  ? "Ошибка загрузки"
                  : "Выберите объект для загрузки"}
              </span>
            )}
          </div>
        )}

        {/* Строка ввода сообщения */}
        <div className="flex gap-2 items-end">
          {/* Скрытый input для файла */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Кнопка прикрепления */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="flex-shrink-0 h-10 w-10"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || !selectedAgent}
            title="Прикрепить изображение"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              selectedObject
                ? `Спросить про "${selectedObject.name}"... (Shift+Enter — новая строка)`
                : "Напишите сообщение... (Shift+Enter — новая строка)"
            }
            disabled={isStreaming || !selectedAgent}
            rows={1}
            style={{ resize: "none", minHeight: "40px", maxHeight: "160px" }}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2
                       text-sm focus-visible:outline-none focus-visible:ring-1
                       focus-visible:ring-ring disabled:cursor-not-allowed
                       disabled:opacity-50 overflow-y-auto"
          />

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !selectedAgent}
            size="icon"
            className="flex-shrink-0 h-10 w-10"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

      </div>
    </div>
  )
}
