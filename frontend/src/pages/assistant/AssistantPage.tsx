import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import React from "react"
import {
  BrainCircuit,
  Sparkles,
  StickyNote,
  FolderOpen,
  Layers,
  PieChart,
  FileText,
  MoreHorizontal,
  Plus,
  ChevronDown,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Bookmark,
  Download,
  Edit2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Settings2,
  User,
  Upload,
  ChevronLeft,
} from "lucide-react"
import {
  assistantApi,
  type AssistantNote,
  type AssistantNoteDetail,
  type KBFile,
  type ChunkPreview,
  type SourceItem,
} from "@/api/assistant"
import { useUiStore } from "@/store/uiStore"
import { useAuthStore } from "@/store/authStore"

const BASE_URL = import.meta.env.VITE_API_URL || ""

// ── Types ───────────────────────────────────────────────────────────────────

type View = "knowledge" | "chat"
type KnowledgeTab = "all" | "notes" | "files" | "chunks"
type SortOrder = "newest" | "oldest"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  sources?: SourceItem[]
  timestamp: Date
}

type ModalItemRef = { type: "note" | "file"; id: string } | null

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  if (date >= todayStart) return "Обновлено сегодня"
  if (date >= yesterdayStart) return "Обновлено вчера"
  return `Обновлено ${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

// ── New Note Modal ───────────────────────────────────────────────────────────

function NewNoteModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void
  onSave: (title: string, content: string) => void
  saving: boolean
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Новая заметка</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#22b722] w-full"
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#22b722] w-full resize-none"
            placeholder="Содержимое заметки..."
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => onSave(title, content)}
            disabled={!title.trim() || !content.trim() || saving}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#22b722] text-white hover:bg-[#1a9a1a] disabled:opacity-50 transition-colors"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Item Modal ───────────────────────────────────────────────────────────────

function ItemModal({
  item,
  notes,
  files,
  chunks,
  onClose,
  onDeleted,
}: {
  item: ModalItemRef
  notes: AssistantNote[]
  files: KBFile[]
  chunks: ChunkPreview[]
  onClose: () => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const [noteDetail, setNoteDetail] = useState<AssistantNoteDetail | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!item || item.type !== "note") return
    setLoadingDetail(true)
    assistantApi
      .getNote(item.id)
      .then((d) => {
        setNoteDetail(d)
        setEditTitle(d.title)
        setEditContent(d.content)
        setLoadingDetail(false)
      })
      .catch(() => setLoadingDetail(false))
  }, [item?.id, item?.type])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, title, content }: { id: string; title: string; content: string }) =>
      assistantApi.updateNote(id, title, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-notes"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      setEditMode(false)
      onClose()
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: assistantApi.deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-notes"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      onDeleted()
      onClose()
    },
  })

  const deleteFileMutation = useMutation({
    mutationFn: assistantApi.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-files"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      onDeleted()
      onClose()
    },
  })

  if (!item) return null

  // Note modal
  if (item.type === "note") {
    const note = notes.find((n) => n.id === item.id)
    return (
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {noteDetail?.title ?? note?.title ?? "Заметка"}
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Заметка · {note ? formatDisplayDate(note.updated_at) : ""}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-4 flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : editMode ? (
              <div className="flex flex-col gap-3">
                <input
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#22b722] w-full"
                  placeholder="Заголовок"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <textarea
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#22b722] w-full resize-none min-h-[300px]"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                {noteDetail?.content ?? ""}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <div>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Редактировать
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <button
                    onClick={() => {
                      setEditMode(false)
                      setEditTitle(noteDetail?.title ?? "")
                      setEditContent(noteDetail?.content ?? "")
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      if (noteDetail) {
                        updateNoteMutation.mutate({ id: noteDetail.id, title: editTitle, content: editContent })
                      }
                    }}
                    disabled={!editTitle.trim() || !editContent.trim() || updateNoteMutation.isPending}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[#22b722] text-white hover:bg-[#1a9a1a] disabled:opacity-50 transition-colors"
                  >
                    {updateNoteMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (window.confirm("Удалить заметку и все её фрагменты?")) {
                        deleteNoteMutation.mutate(item.id)
                      }
                    }}
                    disabled={deleteNoteMutation.isPending}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Закрыть
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // File modal
  if (item.type === "file") {
    const file = files.find((f) => f.id === item.id)
    if (!file) return null
    const fileChunks = chunks.filter(
      (c) => c.source_type === "file" && c.source_name === file.original_name
    )
    const ext = file.original_name.split(".").pop()?.toUpperCase() ?? "FILE"

    return (
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{file.original_name}</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Файл · {ext} · {formatBytes(file.size_bytes)} · {formatDisplayDate(file.created_at)}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-4 flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-slate-50">
              {file.status === "indexed" && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-slate-700">
                    Проиндексировано ({fileChunks.length}{" "}
                    {fileChunks.length === 1 ? "фрагмент" : fileChunks.length < 5 ? "фрагмента" : "фрагментов"})
                  </span>
                </>
              )}
              {file.status === "processing" && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span className="text-sm text-slate-700">Индексирование...</span>
                </>
              )}
              {file.status === "error" && (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">{file.error_message || "Ошибка индексации"}</span>
                </>
              )}
            </div>

            {fileChunks.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-slate-700 mb-1">Фрагменты:</h3>
                {fileChunks.map((chunk) => (
                  <div key={chunk.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <p className="text-xs font-medium text-slate-500 mb-1">Фрагмент #{chunk.chunk_index}</p>
                    <p className="text-sm text-slate-700">{chunk.chunk_text_preview}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <button
              onClick={() => file.public_url && window.open(file.public_url)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Download className="h-4 w-4" />
              Скачать файл
            </button>
            <button
              onClick={() => {
                if (window.confirm("Удалить файл и все его фрагменты?")) {
                  deleteFileMutation.mutate(file.id)
                }
              }}
              disabled={deleteFileMutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AssistantPage() {
  const { setSidebarOpen } = useUiStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    setSidebarOpen(false)
  }, [])

  // ── View / UI state ────────────────────────────────────────────────────

  const [view, setView] = useState<View>("knowledge")
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<ModalItemRef>(null)
  const [newNoteModal, setNewNoteModal] = useState(false)

  // ── Chat state ─────────────────────────────────────────────────────────

  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [lastSources, setLastSources] = useState<SourceItem[]>([])
  const [lastAnswer, setLastAnswer] = useState("")
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [showAllSources, setShowAllSources] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const pendingSendRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ["assistant-stats"],
    queryFn: assistantApi.getStats,
  })

  const { data: notes = [] } = useQuery({
    queryKey: ["assistant-notes"],
    queryFn: assistantApi.listNotes,
  })

  const { data: files = [] } = useQuery({
    queryKey: ["assistant-files"],
    queryFn: assistantApi.listFiles,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.some((f: KBFile) => f.status === "processing") ? 3000 : false
    },
  })

  const { data: chunks = [] } = useQuery({
    queryKey: ["assistant-chunks"],
    queryFn: () => assistantApi.listChunks("all"),
  })

  const { data: chatHistory } = useQuery({
    queryKey: ["assistant-chat-history"],
    queryFn: () => assistantApi.getChatHistory(50),
  })

  // ── Mutations ──────────────────────────────────────────────────────────

  const createNoteMutation = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      assistantApi.createNote(title, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-notes"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-chunks"] })
      setNewNoteModal(false)
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: assistantApi.deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-notes"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-chunks"] })
    },
  })

  const deleteFileMutation = useMutation({
    mutationFn: assistantApi.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-files"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-chunks"] })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => assistantApi.uploadFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-files"] })
      queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
    },
  })

  // ── Effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (chatHistory && !historyLoaded) {
      setMessages(
        chatHistory.map((h) => ({
          role: h.role,
          content: h.content,
          timestamp: new Date(h.created_at),
        }))
      )
      setHistoryLoaded(true)
    }
  }, [chatHistory, historyLoaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (view === "chat" && pendingSendRef.current) {
      const msg = pendingSendRef.current
      pendingSendRef.current = null
      sendMessageWithText(msg)
    }
  }, [view])

  // ── Chat logic ─────────────────────────────────────────────────────────

  const generateSuggestions = async (answer: string) => {
    const token = useAuthStore.getState().accessToken
    try {
      const response = await fetch(`${BASE_URL}/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: `На основе этого ответа: "${answer.slice(0, 300)}"
Предложи ровно 3 коротких уточняющих вопроса (максимум 6 слов каждый).
Ответь ТОЛЬКО JSON массивом строк без объяснений. Пример: ["вопрос 1","вопрос 2","вопрос 3"]`,
        }),
      })
      if (!response.ok) return
      const reader = response.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let fullText = ""
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
          if (data === "[DONE]") break
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === "text") fullText += parsed.content
          } catch {
            // skip
          }
        }
      }
      const match = fullText.match(/\[[\s\S]*?\]/)
      if (match) {
        const questions = JSON.parse(match[0])
        if (Array.isArray(questions)) {
          setSuggestedQuestions(
            questions.slice(0, 3).filter((q: unknown) => typeof q === "string")
          )
        }
      }
    } catch {
      // silently fail
    }
  }

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() || isStreaming) return
    setChatInput("")
    setIsStreaming(true)
    setSuggestedQuestions([])
    setShowAllSources(false)

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date() },
      { role: "assistant", content: "", isStreaming: true, sources: [], timestamp: new Date() },
    ])

    let accumulated = ""

    await assistantApi.streamChat(
      text,
      (chunk) => {
        accumulated += chunk
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk }
          }
          return updated
        })
      },
      (sources) => {
        setLastSources(sources)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, sources }
          }
          return updated
        })
      },
      () => {
        setIsStreaming(false)
        setLastAnswer(accumulated)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false }
          }
          return updated
        })
        queryClient.invalidateQueries({ queryKey: ["assistant-stats"] })
        generateSuggestions(accumulated)
      },
      (err) => {
        setIsStreaming(false)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: `Ошибка: ${err}`, isStreaming: false }
          }
          return updated
        })
      }
    )
  }

  const switchToChat = (initialMessage?: string) => {
    setView("chat")
    if (initialMessage?.trim()) {
      pendingSendRef.current = initialMessage
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────

  const chunkCountBySource = chunks.reduce<Record<string, number>>((acc, c) => {
    acc[c.source_name] = (acc[c.source_name] ?? 0) + 1
    return acc
  }, {})

  type KnowledgeEntry =
    | { kind: "note"; item: AssistantNote; date: Date }
    | { kind: "file"; item: KBFile; date: Date }

  const allEntries: KnowledgeEntry[] = [
    ...notes.map((n) => ({ kind: "note" as const, item: n, date: new Date(n.updated_at) })),
    ...files.map((f) => ({ kind: "file" as const, item: f, date: new Date(f.created_at) })),
  ]

  const filteredEntries = allEntries
    .filter((e) => {
      if (activeTab === "notes") return e.kind === "note"
      if (activeTab === "files") return e.kind === "file"
      return true
    })
    .filter((e) => {
      if (!searchQuery.trim()) return true
      const name = e.kind === "note" ? e.item.title : (e.item as KBFile).original_name
      return name.toLowerCase().includes(searchQuery.toLowerCase())
    })
    .sort((a, b) =>
      sortOrder === "newest"
        ? b.date.getTime() - a.date.getTime()
        : a.date.getTime() - b.date.getTime()
    )

  const filteredChunks = chunks
    .filter((c) => {
      if (!searchQuery.trim()) return true
      return (
        c.source_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.chunk_text_preview.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
    .sort((a, b) =>
      sortOrder === "newest"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  const lastNoteDate =
    notes.length > 0
      ? notes.reduce((a, b) => (new Date(a.updated_at) > new Date(b.updated_at) ? a : b)).updated_at
      : null
  const lastFileDate =
    files.length > 0
      ? files.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b)).created_at
      : null

  const displayedSources = showAllSources ? lastSources : lastSources.slice(0, 3)

  const closeAllMenus = () => {
    setOpenMenuId(null)
    setShowSortMenu(false)
    setShowAddMenu(false)
  }

  // ── Knowledge View ─────────────────────────────────────────────────────

  const renderKnowledgeView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-6 pb-4">
        <div className="w-14 h-14 rounded-xl bg-[#22b722] flex items-center justify-center flex-shrink-0">
          <BrainCircuit className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Мой AI Ассистент</h1>
          <p className="text-sm text-slate-500">Ваш персональный интеллектуальный помощник</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-6 mb-4">
        <div className="flex items-center bg-white rounded-2xl shadow-sm border border-slate-100 h-[52px] px-4 gap-3">
          <Sparkles className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Спросите что угодно о ваших знаниях..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) switchToChat(searchQuery)
            }}
            className="flex-1 text-sm text-slate-700 outline-none bg-transparent placeholder-slate-400"
          />
          <button
            onClick={() => switchToChat(searchQuery || undefined)}
            className="w-8 h-8 rounded-full bg-[#22b722] flex items-center justify-center flex-shrink-0 hover:bg-[#1a9a1a] transition-colors"
          >
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="px-6 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f0faf0] flex items-center justify-center flex-shrink-0">
                  <StickyNote className="h-5 w-5 text-[#22b722]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-slate-800 leading-none">{stats.notes_count}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {stats.notes_count === 1 ? "Заметка" : "Заметки"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {lastNoteDate ? formatRelativeDate(lastNoteDate) : "Нет заметок"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eff6ff] flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="h-5 w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-slate-800 leading-none">{stats.files_count}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {stats.files_count === 1 ? "Файл" : "Файлов"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {lastFileDate ? formatRelativeDate(lastFileDate) : "Нет файлов"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f5f3ff] flex items-center justify-center flex-shrink-0">
                  <Layers className="h-5 w-5 text-purple-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-slate-800 leading-none">{stats.chunks_count}</p>
                  <p className="text-sm text-slate-600 mt-1">Фрагментов</p>
                  <p className="text-[10px] text-slate-400 mt-1">Индексировано</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#fff7ed] flex items-center justify-center flex-shrink-0">
                  <PieChart className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-800 leading-none">
                    {formatBytes(stats.total_size_bytes)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Объём данных</p>
                  <p className="text-[10px] text-slate-400 mt-1">Занято места</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs + controls */}
      <div className="px-6 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {(["all", "notes", "files", "chunks"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white border border-[#22b722] text-[#22b722] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "all"
                  ? "Все"
                  : tab === "notes"
                  ? "Заметки"
                  : tab === "files"
                  ? "Файлы"
                  : "Фрагменты"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setShowSortMenu(!showSortMenu); setShowAddMenu(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
              >
                {sortOrder === "newest" ? "Сначала новые" : "Сначала старые"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[160px]">
                  {(["newest", "oldest"] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => { setSortOrder(o); setShowSortMenu(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl ${
                        sortOrder === o ? "text-[#22b722] font-medium" : "text-slate-700"
                      }`}
                    >
                      {o === "newest" ? "Сначала новые" : "Сначала старые"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add */}
            {activeTab !== "chunks" && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    if (activeTab === "notes") {
                      setNewNoteModal(true)
                    } else if (activeTab === "files") {
                      fileInputRef.current?.click()
                    } else {
                      setShowAddMenu(!showAddMenu)
                      setShowSortMenu(false)
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium bg-white border border-[#22b722] text-[#22b722] hover:bg-[#f0faf0] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Добавить
                </button>
                {showAddMenu && activeTab === "all" && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[180px]">
                    <button
                      onClick={() => { setShowAddMenu(false); setNewNoteModal(true) }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 rounded-t-xl text-slate-700 flex items-center gap-2"
                    >
                      <StickyNote className="h-4 w-4 text-[#22b722]" />
                      Новая заметка
                    </button>
                    <button
                      onClick={() => { setShowAddMenu(false); fileInputRef.current?.click() }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 rounded-b-xl text-slate-700 flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4 text-blue-500" />
                      Загрузить файл
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {/* Empty state */}
        {activeTab !== "chunks" && filteredEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BrainCircuit className="h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              Загрузите файлы или создайте заметки
            </p>
            <button
              onClick={() => setNewNoteModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#22b722] text-white hover:bg-[#1a9a1a] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Добавить
            </button>
          </div>
        )}

        {activeTab === "chunks" && filteredChunks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Layers className="h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">Фрагментов пока нет</p>
          </div>
        )}

        {/* Notes + Files */}
        {activeTab !== "chunks" &&
          filteredEntries.map((entry) => {
            const entryId = entry.item.id
            const menuKey = `${entry.kind}-${entryId}`
            const isNote = entry.kind === "note"
            const name = isNote
              ? (entry.item as AssistantNote).title
              : (entry.item as KBFile).original_name
            const chunkCount = chunkCountBySource[name] ?? 0
            const dateStr = isNote
              ? formatDisplayDate((entry.item as AssistantNote).updated_at)
              : formatDisplayDate((entry.item as KBFile).created_at)
            const fileStatus = !isNote ? (entry.item as KBFile).status : null

            return (
              <div
                key={menuKey}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3 cursor-pointer hover:border-slate-200 hover:shadow-md transition-all"
                onClick={() => {
                  if (openMenuId) { setOpenMenuId(null); return }
                  setModalItem({ type: entry.kind as "note" | "file", id: entryId })
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isNote ? "bg-[#f0faf0]" : "bg-[#eff6ff]"
                    }`}
                  >
                    <FileText
                      className={`h-5 w-5 ${isNote ? "text-[#22b722]" : "text-blue-500"}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{name}</p>
                    {!isNote && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatBytes((entry.item as KBFile).size_bytes)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22b722] inline-block" />
                        {dateStr}
                      </span>
                      {fileStatus === "processing" ? (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Индексирование...
                        </span>
                      ) : fileStatus === "error" ? (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          Ошибка
                        </span>
                      ) : chunkCount > 0 ? (
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {chunkCount}{" "}
                          {chunkCount === 1
                            ? "фрагмент"
                            : chunkCount < 5
                            ? "фрагмента"
                            : "фрагментов"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Three-dot menu */}
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        setOpenMenuId(openMenuId === menuKey ? null : menuKey)
                      }
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenuId === menuKey && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 z-20 min-w-[160px]">
                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            setModalItem({ type: entry.kind as "note" | "file", id: entryId })
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 rounded-t-xl text-slate-700"
                        >
                          Открыть
                        </button>
                        {!isNote && (
                          <button
                            onClick={() => {
                              setOpenMenuId(null)
                              const f = entry.item as KBFile
                              if (f.public_url) window.open(f.public_url)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-700"
                          >
                            Скачать
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            const msg = isNote
                              ? "Удалить заметку и все её фрагменты?"
                              : "Удалить файл и все его фрагменты?"
                            if (window.confirm(msg)) {
                              if (isNote) deleteNoteMutation.mutate(entryId)
                              else deleteFileMutation.mutate(entryId)
                            }
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 rounded-b-xl text-red-500"
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

        {/* Chunks */}
        {activeTab === "chunks" &&
          filteredChunks.map((chunk) => (
            <div
              key={chunk.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f5f3ff] flex items-center justify-center flex-shrink-0">
                  <Layers className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium text-slate-800 text-sm truncate">{chunk.source_name}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      Фрагмент #{chunk.chunk_index}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{chunk.chunk_text_preview}</p>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22b722] inline-block" />
                    {formatShortDate(chunk.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Floating ask button */}
      <button
        onClick={() => setView("chat")}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-6 py-3.5 bg-[#22b722] text-white rounded-3xl shadow-lg hover:bg-[#1a9a1a] transition-colors font-medium text-sm z-40"
      >
        <Sparkles className="h-4 w-4" />
        Спросить ассистента
      </button>
    </div>
  )

  // ── Chat View ──────────────────────────────────────────────────────────

  const renderChatView = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("knowledge")}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#22b722] flex items-center justify-center">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Мой AI Ассистент</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-slate-500">Онлайн · Готов отвечать на ваши вопросы</span>
            </div>
          </div>
        </div>
        <button className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: messages + input */}
        <div className="flex flex-col flex-1 min-w-0">
          {stats && stats.chunks_count === 0 && (
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Добавьте материалы, чтобы ассистент мог отвечать
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <BrainCircuit className="h-12 w-12 opacity-20" />
                <p className="text-sm">Задайте вопрос по вашей базе знаний</p>
              </div>
            )}

            {messages.map((msg, idx) =>
              msg.role === "user" ? (
                <div key={idx} className="flex justify-end items-start gap-2">
                  <div className="max-w-[70%]">
                    <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                      <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    </div>
                    <p className="text-right text-xs text-slate-400 mt-1">{formatTime(msg.timestamp)}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
              ) : (
                <div key={idx} className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#22b722] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BrainCircuit className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 shadow-sm leading-relaxed">
                      {msg.isStreaming && !msg.content ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : (
                        <div className="assistant-prose">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => <p className="font-semibold text-slate-800 text-base mb-2 mt-3 first:mt-0">{children}</p>,
                              h2: ({ children }) => <p className="font-semibold text-slate-800 mb-1.5 mt-3 first:mt-0">{children}</p>,
                              h3: ({ children }) => <p className="font-medium text-slate-700 mb-1 mt-2 first:mt-0">{children}</p>,
                              p: ({ children }) => <p className="mb-2 last:mb-0 text-slate-700 leading-relaxed">{children}</p>,
                              strong: ({ children }) => <span className="font-semibold text-slate-800">{children}</span>,
                              em: ({ children }) => <span className="italic text-slate-600">{children}</span>,
                              ul: ({ children }) => (
                                <ul className="mb-2 space-y-1.5 pl-0 list-none">{children}</ul>
                              ),
                              ol: ({ children }) => {
                                let idx = 0
                                const numbered = React.Children.map(children, (child) => {
                                  if (!React.isValidElement(child)) return child
                                  idx++
                                  return React.cloneElement(child as React.ReactElement<{ "data-n": number }>, { "data-n": idx })
                                })
                                return <ol className="mb-2 space-y-1.5 pl-0 list-none">{numbered}</ol>
                              },
                              li: ({ children, ...rest }) => {
                                const num = (rest as Record<string, unknown>)["data-n"] as number | undefined
                                return num != null ? (
                                  <li className="flex items-start gap-2.5 text-slate-700">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f0faf0] text-[#22b722] text-[11px] font-bold flex items-center justify-center mt-0.5">
                                      {num}
                                    </span>
                                    <span className="flex-1 leading-relaxed">{children}</span>
                                  </li>
                                ) : (
                                  <li className="flex items-start gap-2.5 text-slate-700">
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#22b722] mt-2.5" />
                                    <span className="flex-1 leading-relaxed">{children}</span>
                                  </li>
                                )
                              },
                              hr: () => <div className="border-t border-slate-100 my-3" />,
                              blockquote: ({ children }) => (
                                <div className="border-l-2 border-[#22b722] pl-3 my-2 text-slate-600 italic">{children}</div>
                              ),
                              code: ({ children, className }) => {
                                const isBlock = className?.includes("language-")
                                return isBlock ? (
                                  <div className="bg-slate-50 rounded-xl px-3 py-2 my-2 text-xs text-slate-700 font-mono overflow-x-auto">{children}</div>
                                ) : (
                                  <span className="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono text-slate-700">{children}</span>
                                )
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {!msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-2 mt-1.5 px-1 flex-wrap">
                        <span className="text-xs text-slate-400">{formatTime(msg.timestamp)}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.content)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Копировать"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                        {msg.sources && msg.sources.length > 0 && (
                          <button
                            onClick={() => setShowAllSources(!showAllSources)}
                            className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                          >
                            Ответ основан на {msg.sources.length} источниках
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {/* Suggested questions */}
            {suggestedQuestions.length > 0 && !isStreaming && (
              <div className="mt-2">
                <p className="text-xs text-slate-400 mb-2 px-1">Возможно, вы имели в виду:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessageWithText(q)}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-[#22b722] hover:text-[#22b722] transition-colors"
                    >
                      {q}
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4">
            <div className="bg-[#f2f4f7] border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-end px-4 py-3 gap-3">
                <Sparkles className="h-4 w-4 text-slate-400 flex-shrink-0 mb-1" />
                <textarea
                  ref={chatInputRef}
                  className="flex-1 text-sm text-slate-700 outline-none resize-none bg-transparent placeholder-slate-400 min-h-[24px] max-h-[160px]"
                  placeholder="Спросите что угодно о ваших знаниях..."
                  rows={1}
                  value={chatInput}
                  disabled={isStreaming}
                  onChange={(e) => {
                    setChatInput(e.target.value)
                    e.target.style.height = "auto"
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessageWithText(chatInput)
                    }
                  }}
                />
                <button
                  onClick={() => sendMessageWithText(chatInput)}
                  disabled={isStreaming || !chatInput.trim()}
                  className="w-8 h-8 rounded-full bg-[#22b722] flex items-center justify-center flex-shrink-0 hover:bg-[#1a9a1a] disabled:opacity-40 transition-colors"
                >
                  {isStreaming ? (
                    <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 text-white" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              ⓘ AI может ошибаться. Проверяйте важную информацию.
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="hidden lg:flex flex-col w-72 border-l border-slate-100 overflow-y-auto p-4 gap-5 bg-[#f9fafb]">
          {/* Sources */}
          {lastSources.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Источники ответа</h3>
                <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {lastSources.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {displayedSources.map((src, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {src.source_type === "file" ? (
                          <FileText className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <StickyNote className="h-4 w-4 text-[#22b722] flex-shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">
                            {src.source_name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {src.source_type === "file" ? "Файл" : "Заметка"} · Фрагмент{" "}
                            {src.chunk_index}
                          </p>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1" />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{src.excerpt}</p>
                  </div>
                ))}
              </div>
              {lastSources.length > 3 && (
                <button
                  onClick={() => setShowAllSources(!showAllSources)}
                  className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-700 py-1.5 border border-slate-200 rounded-xl hover:bg-white transition-colors"
                >
                  {showAllSources ? "Скрыть" : "Показать все источники"}
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          {lastAnswer && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Действия</h3>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(lastAnswer)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-white transition-colors text-left w-full"
                >
                  <Bookmark className="h-4 w-4 text-slate-400" />
                  Сохранить ответ
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([lastAnswer], { type: "text/plain" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = "ответ-ассистента.txt"
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-white transition-colors text-left w-full"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  Экспортировать
                </button>
                <button
                  onClick={() => {
                    const title = lastAnswer.slice(0, 50).replace(/\n/g, " ").trim() || "Ответ ассистента"
                    createNoteMutation.mutate({ title, content: lastAnswer })
                  }}
                  disabled={createNoteMutation.isPending}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-white transition-colors text-left w-full disabled:opacity-50"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  Создать заметку на основе ответа
                </button>
                <button
                  onClick={() => {
                    setChatInput("Уточни: ")
                    chatInputRef.current?.focus()
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-white transition-colors text-left w-full"
                >
                  <Edit2 className="h-4 w-4 text-slate-400" />
                  Уточнить вопрос
                </button>
              </div>
            </div>
          )}

          {lastSources.length === 0 && !lastAnswer && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-300 gap-2">
              <BrainCircuit className="h-8 w-8 opacity-40" />
              <p className="text-xs text-center text-slate-400">
                Источники и действия появятся после ответа
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full bg-[#f2f4f7]"
      onClick={closeAllMenus}
    >
      {view === "knowledge" ? renderKnowledgeView() : renderChatView()}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadMutation.mutate(file)
          e.target.value = ""
        }}
      />

      {newNoteModal && (
        <NewNoteModal
          onClose={() => setNewNoteModal(false)}
          onSave={(title, content) => createNoteMutation.mutate({ title, content })}
          saving={createNoteMutation.isPending}
        />
      )}

      {modalItem && (
        <ItemModal
          item={modalItem}
          notes={notes}
          files={files}
          chunks={chunks}
          onClose={() => setModalItem(null)}
          onDeleted={() => setModalItem(null)}
        />
      )}
    </div>
  )
}
