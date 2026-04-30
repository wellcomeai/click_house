import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { commentsApi } from "@/api/comments"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import type { ObjectComment } from "@/types"

function formatDate(iso: string): string {
  return format(new Date(iso), "dd MMMM yyyy, HH:mm", { locale: ru })
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(" ")
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

interface Props {
  objectId: string
}

export function ObjectComments({ objectId }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [newText, setNewText] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  const canWrite =
    user?.role === "admin" || user?.role === "manager" || user?.role === "foreman"

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["object-comments", objectId],
    queryFn: () => commentsApi.getByObject(objectId),
  })

  const createMutation = useMutation({
    mutationFn: (text: string) => commentsApi.create(objectId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object-comments", objectId] })
      setNewText("")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      commentsApi.update(objectId, id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object-comments", objectId] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => commentsApi.delete(objectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object-comments", objectId] })
    },
  })

  function startEdit(comment: ObjectComment) {
    setEditingId(comment.id)
    setEditText(comment.text)
  }

  function canModify(comment: ObjectComment): boolean {
    if (user?.role === "admin") return true
    return comment.author_id === user?.id
  }

  if (isLoading) return <p className="text-slate-400">Загрузка...</p>

  return (
    <div className="space-y-4">
      {/* Add form */}
      {canWrite && (
        <div className="space-y-2">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={3}
            placeholder="Добавить запись в журнал..."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          <Button
            size="sm"
            onClick={() => {
              if (newText.trim()) createMutation.mutate(newText.trim())
            }}
            disabled={!newText.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Отправка..." : "Добавить запись"}
          </Button>
        </div>
      )}

      {/* Feed */}
      {comments.length === 0 ? (
        <p className="text-slate-400 text-sm py-6 text-center">Записей пока нет</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              isEditing={editingId === comment.id}
              editText={editText}
              onEditTextChange={setEditText}
              canModify={canModify(comment)}
              onStartEdit={() => startEdit(comment)}
              onSaveEdit={() =>
                updateMutation.mutate({ id: comment.id, text: editText.trim() })
              }
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => deleteMutation.mutate(comment.id)}
              saving={updateMutation.isPending}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  comment: ObjectComment
  isEditing: boolean
  editText: string
  onEditTextChange: (v: string) => void
  canModify: boolean
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  saving: boolean
  deleting: boolean
}

function CommentCard({
  comment,
  isEditing,
  editText,
  onEditTextChange,
  canModify,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  saving,
  deleting,
}: CardProps) {
  return (
    <div className="flex gap-3 p-4 rounded-md border bg-white">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
        {getInitials(comment.author_name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-slate-800">
            {comment.author_name ?? "Неизвестный"}
          </span>
          <span className="text-xs text-slate-400">{formatDate(comment.created_at)}</span>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onSaveEdit}
                disabled={!editText.trim() || saving}
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button size="sm" variant="outline" onClick={onCancelEdit}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.text}</p>
            {canModify && (
              <div className="flex gap-3 mt-2">
                <button
                  className="text-xs text-slate-400 hover:text-slate-600"
                  onClick={onStartEdit}
                >
                  Редактировать
                </button>
                <button
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                  onClick={onDelete}
                  disabled={deleting}
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
}
