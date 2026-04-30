import { useState, useRef } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  Send,
  Plus,
  FileText,
  Download,
  X,
} from "lucide-react"
import { tasksApi } from "@/api/tasks"
import { usersApi } from "@/api/users"
import { filesApi } from "@/api/files"
import { taskCommentsApi } from "@/api/taskComments"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/utils/cn"
import {
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  type TaskStatus,
  type TaskPriority,
} from "@/types"

const STATUS_COLORS: Record<TaskStatus, string> = {
  new: "secondary",
  in_progress: "default",
  review: "warning",
  done: "success",
} as const

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "secondary",
  medium: "outline",
  high: "warning",
  critical: "destructive",
} as const

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [newChecklistItem, setNewChecklistItem] = useState("")
  const [newComment, setNewComment] = useState("")
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState("")
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => tasksApi.getById(id!),
    enabled: !!id,
  })

  const { data: assignee } = useQuery({
    queryKey: ["user", task?.assignee_id],
    queryFn: () => usersApi.getById(task!.assignee_id!),
    enabled: !!task?.assignee_id,
  })

  const { data: files = [] } = useQuery({
    queryKey: ["task-files", id],
    queryFn: () => filesApi.getByTask(id!),
    enabled: !!id,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", id],
    queryFn: () => taskCommentsApi.getByTask(id!),
    enabled: !!id,
  })

  const updateStatus = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.updateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", id] })
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] })
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] })
    },
  })

  const addChecklist = useMutation({
    mutationFn: (title: string) => tasksApi.addChecklist(id!, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", id] })
      setNewChecklistItem("")
    },
  })

  const toggleChecklist = useMutation({
    mutationFn: ({ itemId, is_done }: { itemId: string; is_done: boolean }) =>
      tasksApi.toggleChecklist(id!, itemId, is_done),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", id] })
    },
  })

  const uploadFile = useMutation({
    mutationFn: (file: File) => filesApi.uploadToTask(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-files", id] })
    },
  })

  const addComment = useMutation({
    mutationFn: (text: string) => taskCommentsApi.create(id!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", id] })
      setNewComment("")
    },
  })

  const updateComment = useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) =>
      taskCommentsApi.update(id!, commentId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", id] })
      setEditingCommentId(null)
      setEditingCommentText("")
    },
  })

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => taskCommentsApi.delete(id!, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", id] })
    },
  })

  if (isLoading) return <div className="text-slate-400">Загрузка...</div>
  if (!task) return <div className="text-red-500">Задача не найдена</div>

  const isAssignee = task.assignee_id === user?.id
  const canChangeStatus =
    isAssignee ||
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "foreman"

  const canUploadFiles =
    user?.role === "admin" || user?.role === "manager" || user?.role === "foreman"

  const isOverdue =
    task.deadline &&
    new Date(task.deadline) < new Date() &&
    task.status !== "done"

  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    new: "in_progress",
    in_progress: "review",
    review: "done",
    done: null,
  }

  const statusButtonLabel: Record<TaskStatus, string> = {
    new: "Начать выполнение",
    in_progress: "Отправить на проверку",
    review: "Отметить выполненной",
    done: "",
  }

  const assigneeName = assignee?.profile?.first_name
    ? [assignee.profile.last_name, assignee.profile.first_name].filter(Boolean).join(" ")
    : assignee?.email ?? ""

  const checklistDone = task.checklist.filter((i) => i.is_done).length
  const checklistTotal = task.checklist.length
  const checklistPercent =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0

  const imageFiles = files.filter((f) => f.file_type === "image")
  const docFiles = files.filter((f) => f.file_type !== "image")

  function handleChecklistSubmit() {
    const trimmed = newChecklistItem.trim()
    if (trimmed) addChecklist.mutate(trimmed)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile.mutate(file)
    e.target.value = ""
  }

  function handleCommentSubmit() {
    const trimmed = newComment.trim()
    if (trimmed) addComment.mutate(trimmed)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{task.title}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant={STATUS_COLORS[task.status] as any}>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            <Badge variant={PRIORITY_COLORS[task.priority] as any}>
              {PRIORITY_LABELS[task.priority]}
            </Badge>
            {task.category && (
              <Badge variant="outline">{CATEGORY_LABELS[task.category]}</Badge>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 flex-wrap">
            {task.deadline && (
              <span
                className={cn(
                  "flex items-center gap-1",
                  isOverdue && "text-red-500 font-medium"
                )}
              >
                {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                <Clock className="h-3.5 w-3.5" />
                Срок: {new Date(task.deadline).toLocaleDateString("ru-RU")}
                {isOverdue && " — просрочена"}
              </span>
            )}
            {assignee && (
              <span>
                Исполнитель: <span className="font-medium text-slate-700">{assigneeName}</span>
                {assignee.profile?.position && (
                  <span className="text-slate-400"> · {assignee.profile.position}</span>
                )}
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-2 text-sm text-slate-600">{task.description}</p>
          )}
        </div>

        {canChangeStatus && task.status !== "done" && nextStatus[task.status] && (
          <Button
            onClick={() => updateStatus.mutate(nextStatus[task.status]!)}
            disabled={updateStatus.isPending}
            variant={task.status === "review" ? "default" : "outline"}
            className={cn(task.status === "review" && "bg-green-600 hover:bg-green-700")}
          >
            {statusButtonLabel[task.status]}
          </Button>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Чеклист</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklistTotal > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{checklistDone} / {checklistTotal} выполнено</span>
                    <span>{checklistPercent}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${checklistPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {task.checklist.length === 0 && (
                <p className="text-sm text-slate-400">Пункты не добавлены</p>
              )}

              <ul className="space-y-1.5">
                {task.checklist.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={item.is_done}
                        onChange={(e) =>
                          toggleChecklist.mutate({ itemId: item.id, is_done: e.target.checked })
                        }
                        className="rounded"
                      />
                      <span
                        className={cn(
                          "text-sm",
                          item.is_done && "line-through text-slate-400"
                        )}
                      >
                        {item.title}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2 pt-1">
                <input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChecklistSubmit()}
                  placeholder="Новый пункт..."
                  className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleChecklistSubmit}
                  disabled={!newChecklistItem.trim() || addChecklist.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Комментарии</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                  placeholder="Написать комментарий..."
                  className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCommentSubmit}
                  disabled={!newComment.trim() || addComment.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {comments.length === 0 && (
                <p className="text-sm text-slate-400">Комментариев пока нет</p>
              )}

              <div className="space-y-3">
                {comments.map((comment) => {
                  const initials = comment.author_name
                    ? comment.author_name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "?"
                  const canEdit =
                    comment.author_id === user?.id || user?.role === "admin"

                  return (
                    <div key={comment.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {comment.author_name ?? "Неизвестный"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(comment.created_at).toLocaleString("ru-RU")}
                          </span>
                        </div>

                        {editingCommentId === comment.id ? (
                          <div className="mt-1 space-y-1.5">
                            <input
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  updateComment.mutate({
                                    commentId: comment.id,
                                    text: editingCommentText,
                                  })
                                }
                                disabled={
                                  !editingCommentText.trim() || updateComment.isPending
                                }
                              >
                                Сохранить
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingCommentId(null)}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-slate-600 mt-0.5">{comment.text}</p>
                            {canEdit && (
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => {
                                    setEditingCommentId(comment.id)
                                    setEditingCommentText(comment.text)
                                  }}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                  Изменить
                                </button>
                                <button
                                  onClick={() => deleteComment.mutate(comment.id)}
                                  className="text-xs text-red-400 hover:text-red-600"
                                >
                                  Удалить
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Files */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Файлы</CardTitle>
              {canUploadFiles && (
                <>
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Загрузить
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {uploadFile.isPending && (
                <p className="text-xs text-slate-400">Загрузка файла...</p>
              )}

              {imageFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {imageFiles.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setLightboxUrl(f.public_url)}
                      className="aspect-square rounded-md overflow-hidden border hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={f.public_url}
                        alt={f.original_name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {docFiles.length > 0 && (
                <ul className="space-y-1.5">
                  {docFiles.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="flex-1 truncate text-slate-700">{f.original_name}</span>
                      <span className="text-xs text-slate-400">{formatBytes(f.size_bytes)}</span>
                      <a
                        href={f.public_url}
                        download={f.original_name}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {files.length === 0 && !uploadFile.isPending && (
                <p className="text-sm text-slate-400">Файлы не загружены</p>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Детали</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Создана</span>
                <span>{new Date(task.created_at).toLocaleDateString("ru-RU")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Обновлена</span>
                <span>{new Date(task.updated_at).toLocaleDateString("ru-RU")}</span>
              </div>
              {task.object_id && (
                <div className="pt-1">
                  <Link
                    to={`/objects/${task.object_id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Открыть объект →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-slate-300"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
