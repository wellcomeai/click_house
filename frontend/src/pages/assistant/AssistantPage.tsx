import { useState, useRef, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  BrainCircuit,
  Send,
  Bot,
  User,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  ChevronDown,
  ChevronUp,
  X,
  Database,
  MessageSquare,
  StickyNote,
  Files,
} from "lucide-react"
import { assistantApi, type AssistantNote, type AssistantNoteDetail, type KBFile, type SourceItem } from "@/api/assistant"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "chat" | "notes" | "files" | "kb"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  sources?: SourceItem[]
  showSources?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// ── Tab buttons ────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "chat", label: "Чат", icon: MessageSquare },
  { key: "notes", label: "Заметки", icon: StickyNote },
  { key: "files", label: "Файлы", icon: Files },
  { key: "kb", label: "База знаний", icon: Database },
]

// ── Note Modal ─────────────────────────────────────────────────────────────

function NoteModal({
  note,
  onClose,
  onSave,
}: {
  note: AssistantNoteDetail | null
  onClose: () => void
  onSave: (title: string, content: string) => void
}) {
  const [title, setTitle] = useState(note?.title ?? "")
  const [content, setContent] = useState(note?.content ?? "")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {note ? "Редактировать заметку" : "Новая заметка"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <input
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 w-full"
          placeholder="Заголовок"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 w-full resize-none"
          placeholder="Содержимое заметки..."
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="text-sm">
            Отмена
          </Button>
          <Button
            onClick={() => onSave(title, content)}
            disabled={!title.trim() || !content.trim()}
            className="text-sm bg-[#22b722] hover:bg-[#1ea01e] text-white border-0"
          >
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function AssistantPage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat")
  const queryClient = useQueryClient()

  // ── Chat state ────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: stats } = useQuery({
    queryKey: ["assistant-stats"],
    queryFn: assistantApi.getStats,
  })

  const { data: chatHistory } = useQuery({
    queryKey: ["assistant-chat-history"],
    queryFn: () => assistantApi.getChatHistory(50),
  })

  useEffect(() => {
    if (chatHistory && !historyLoaded) {
      setMessages(
        chatHistory.map((h) => ({
          role: h.role,
          content: h.content,
        }))
      )
      setHistoryLoaded(true)
    }
  }, [chatHistory, historyLoaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput("")
    setIsStreaming(true)

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", isStreaming: true, sources: [] },
    ])

    await assistantApi.streamChat(
      text,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            }
          }
          return updated
        })
      },
      (sources) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, sources }
          }
          return updated
        })
      },
      () => {
        setIsStreaming(false)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false }
          }
          return updated
        })
        queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      },
      (err) => {
        setIsStreaming(false)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: `Ошибка: ${err}`,
              isStreaming: false,
            }
          }
          return updated
        })
      },
    )
  }

  const clearHistoryMutation = useMutation({
    mutationFn: assistantApi.clearChatHistory,
    onSuccess: () => {
      setMessages([])
      setHistoryLoaded(false)
      queryClient.invalidateQueries({ queryKey: ["assistant-chat-history"] })
    },
  })

  const toggleSources = (idx: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, showSources: !m.showSources } : m
      )
    )
  }

  // ── Notes state ───────────────────────────────────────────────────────

  const [noteModal, setNoteModal] = useState<{
    open: boolean
    note: AssistantNoteDetail | null
  }>({ open: false, note: null })
  const [noteSavedMsg, setNoteSavedMsg] = useState("")

  const { data: notes = [] } = useQuery({
    queryKey: ["assistant-notes"],
    queryFn: assistantApi.listNotes,
  })

  const createNoteMutation = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      assistantApi.createNote(title, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-notes"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      setNoteModal({ open: false, note: null })
      setNoteSavedMsg("Заметка сохранена и проиндексирована")
      setTimeout(() => setNoteSavedMsg(""), 3000)
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: ({
      id,
      title,
      content,
    }: {
      id: string
      title: string
      content: string
    }) => assistantApi.updateNote(id, title, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-notes"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      setNoteModal({ open: false, note: null })
      setNoteSavedMsg("Заметка обновлена и переиндексирована")
      setTimeout(() => setNoteSavedMsg(""), 3000)
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: assistantApi.deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-notes"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
    },
  })

  const openEditNote = async (note: AssistantNote) => {
    const detail = await assistantApi.getNote(note.id)
    setNoteModal({ open: true, note: detail })
  }

  const handleNoteSave = (title: string, content: string) => {
    if (noteModal.note) {
      updateNoteMutation.mutate({ id: noteModal.note.id, title, content })
    } else {
      createNoteMutation.mutate({ title, content })
    }
  }

  // ── Files state ───────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data: files = [] } = useQuery({
    queryKey: ["assistant-files"],
    queryFn: assistantApi.listFiles,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.some((f: KBFile) => f.status === "processing") ? 3000 : false
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => assistantApi.uploadFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-files"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
    },
  })

  const deleteFileMutation = useMutation({
    mutationFn: assistantApi.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-files"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
    },
  })

  const handleFileUpload = (file: File) => {
    uploadMutation.mutate(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  // ── KB / chunks state ─────────────────────────────────────────────────

  const [chunkFilter, setChunkFilter] = useState<"all" | "note" | "file">("all")

  const { data: chunks = [] } = useQuery({
    queryKey: ["assistant-chunks", chunkFilter],
    queryFn: () => assistantApi.listChunks(chunkFilter),
  })

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#22b722] flex items-center justify-center">
          <BrainCircuit className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Мой AI Ассистент</h1>
          <p className="text-xs text-slate-500">Отвечает только по вашим документам</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-[#22b722] text-[#22b722]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab: Chat */}
      {activeTab === "chat" && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Empty KB warning */}
          {stats && stats.chunks_count === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Загрузите файлы или создайте заметки, чтобы ассистент мог отвечать на ваши вопросы
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <BrainCircuit className="h-12 w-12 opacity-30" />
                <p className="text-sm">Задайте вопрос по вашей базе знаний</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === "user" ? "bg-blue-600" : "bg-[#3d3d3d]"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="max-w-[80%] flex flex-col gap-1">
                  <div
                    className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
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
                  {/* Sources */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1">
                      <button
                        onClick={() => toggleSources(idx)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {msg.showSources ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        Источники ({msg.sources.length})
                      </button>
                      {msg.showSources && (
                        <div className="mt-1 flex flex-col gap-1">
                          {msg.sources.map((src, si) => (
                            <div
                              key={si}
                              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    src.source_type === "note"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-purple-100 text-purple-700"
                                  }`}
                                >
                                  {src.source_type === "note" ? "Заметка" : "Файл"}
                                </span>
                                <span className="font-medium truncate">{src.source_name}</span>
                                <span className="ml-auto text-slate-400 flex-shrink-0">
                                  {Math.round(src.similarity * 100)}%
                                </span>
                              </div>
                              <p className="text-slate-500 line-clamp-2">{src.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => clearHistoryMutation.mutate()}
              disabled={clearHistoryMutation.isPending || messages.length === 0}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
            >
              Очистить историю
            </button>
          </div>

          {/* Input */}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-slate-400 min-h-[48px] max-h-[160px]"
              placeholder="Задайте вопрос..."
              rows={1}
              value={input}
              disabled={isStreaming}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = "auto"
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              className="bg-[#22b722] hover:bg-[#1ea01e] text-white border-0 h-12 w-12 p-0 flex items-center justify-center rounded-xl flex-shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Tab: Notes */}
      {activeTab === "notes" && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          <div className="flex items-center justify-between">
            {noteSavedMsg && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {noteSavedMsg}
              </span>
            )}
            {!noteSavedMsg && <div />}
            <Button
              onClick={() => setNoteModal({ open: true, note: null })}
              className="bg-[#22b722] hover:bg-[#1ea01e] text-white border-0 text-sm flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Новая заметка
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {notes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <StickyNote className="h-12 w-12 opacity-30" />
                <p className="text-sm">Заметок пока нет</p>
              </div>
            )}
            {notes.map((note) => (
              <Card key={note.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{note.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Обновлено {formatDate(note.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEditNote(note)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Удалить заметку и все её фрагменты?")) {
                        deleteNoteMutation.mutate(note.id)
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Files */}
      {activeTab === "files" && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              isDragging
                ? "border-[#22b722] bg-green-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-8 w-8 text-[#22b722] animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-slate-300" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                {uploadMutation.isPending ? "Загрузка..." : "Перетащите файл или нажмите"}
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT, MD · до 100 МБ</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ""
            }}
          />

          {/* File list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {files.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <Files className="h-12 w-12 opacity-30" />
                <p className="text-sm">Файлов пока нет</p>
              </div>
            )}
            {files.map((file) => (
              <Card key={file.id} className="p-4 flex items-center gap-3">
                <FileText className="h-8 w-8 text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{file.original_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size_bytes)}</p>
                  <div className="mt-1">
                    {file.status === "processing" && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Индексирование...
                      </span>
                    )}
                    {file.status === "indexed" && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Проиндексировано
                      </span>
                    )}
                    {file.status === "error" && (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {file.error_message || "Ошибка индексации"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Удалить файл и все его фрагменты?")) {
                      deleteFileMutation.mutate(file.id)
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Knowledge Base */}
      {activeTab === "kb" && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Заметок", value: stats.notes_count },
                { label: "Файлов", value: stats.files_count },
                { label: "Фрагментов", value: stats.chunks_count },
                { label: "Объём", value: formatBytes(stats.total_size_bytes) },
              ].map((item) => (
                <Card key={item.label} className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-800">{item.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{item.label}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Filter */}
          <div className="flex gap-2">
            {(["all", "note", "file"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setChunkFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  chunkFilter === f
                    ? "bg-[#22b722] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f === "all" ? "Все" : f === "note" ? "Из заметок" : "Из файлов"}
              </button>
            ))}
          </div>

          {/* Chunks list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {chunks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <Database className="h-12 w-12 opacity-30" />
                <p className="text-sm">
                  {chunkFilter === "all"
                    ? "База знаний пуста — загрузите файлы или создайте заметки"
                    : "Нет фрагментов выбранного типа"}
                </p>
              </div>
            )}
            {chunks.map((chunk) => (
              <Card key={chunk.id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      chunk.source_type === "note"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {chunk.source_type === "note" ? "Заметка" : "Файл"}
                  </span>
                  <span className="text-sm font-medium text-slate-700 truncate flex-1">
                    {chunk.source_name}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
                    Фрагмент #{chunk.chunk_index}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-3">{chunk.chunk_text_preview}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModal.open && (
        <NoteModal
          note={noteModal.note}
          onClose={() => setNoteModal({ open: false, note: null })}
          onSave={handleNoteSave}
        />
      )}
    </div>
  )
}
