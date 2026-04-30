import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { FileText, Download, X, MessageSquare, Upload, Loader2 } from "lucide-react"
import { filesApi } from "@/api/files"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import type { ObjectFile } from "@/types"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

interface Props {
  objectId: string
}

export function ObjectFiles({ objectId }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [captionInput, setCaptionInput] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState("")

  const canUpload =
    user?.role === "admin" || user?.role === "manager" || user?.role === "foreman"

  const canDelete = (file: ObjectFile) =>
    user?.role === "admin" || user?.role === "manager" || file.uploaded_by === user?.id

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["object-files", objectId],
    queryFn: () => filesApi.getByObject(objectId),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) =>
      filesApi.uploadToObject(objectId, file, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object-files", objectId] })
      setPendingFile(null)
      setCaptionInput("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => filesApi.deleteFromObject(objectId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object-files", objectId] })
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    if (file.size > 100 * 1024 * 1024) {
      setSizeError("Файл превышает лимит 100 МБ")
      return
    }
    setSizeError("")
    setPendingFile(file)
  }

  if (isLoading) return <p className="text-slate-400">Загрузка...</p>

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="space-y-3">
          {!pendingFile ? (
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Загрузить файл
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              {sizeError && <p className="text-sm text-red-500">{sizeError}</p>}
            </div>
          ) : (
            <div className="rounded-xl border border-[#e4e8ed] bg-white p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Выбран файл:{" "}
                <span className="text-slate-900">{pendingFile.name}</span>
              </p>
              <input
                type="text"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                placeholder="Подпись к файлу (необязательно)"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {uploadMutation.isError && (
                <p className="text-sm text-red-500">Ошибка загрузки файла</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    uploadMutation.mutate({ file: pendingFile, caption: captionInput })
                  }
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    "Загрузить"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPendingFile(null)
                    setCaptionInput("")
                    setSizeError("")
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <FileText className="h-10 w-10 opacity-40" />
          <p className="text-sm">Файлы не загружены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex gap-4 p-4 bg-white rounded-xl border border-[#e4e8ed] shadow-sm"
            >
              {/* Preview */}
              {file.file_type === "image" ? (
                <img
                  src={file.public_url}
                  alt={file.original_name}
                  onClick={() => setLightboxUrl(file.public_url)}
                  className="w-16 h-16 rounded-lg object-cover cursor-pointer flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-7 w-7 text-slate-400" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Name + badge + size */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#3d3d3d] text-sm truncate">
                    {file.original_name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {file.file_type === "image" ? "Фото" : "Документ"}
                  </span>
                  <span className="text-xs text-slate-400">{formatBytes(file.size_bytes)}</span>
                </div>

                {/* Date */}
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(file.created_at), "dd MMMM yyyy, HH:mm", { locale: ru })}
                </p>

                {/* Uploader */}
                {file.uploader && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-7 h-7 rounded-full bg-[#f0faf0] border border-[#dcf5dc] flex items-center justify-center text-xs font-bold text-[#22b722] flex-shrink-0">
                      {getInitials(file.uploader.full_name || file.uploader.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#3d3d3d]">
                        {file.uploader.full_name || file.uploader.email}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {file.uploader.email}
                        {file.uploader.position && ` · ${file.uploader.position}`}
                        {file.uploader.phone && ` · ${file.uploader.phone}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Caption */}
                {file.caption && (
                  <div className="mt-2 flex items-start gap-1.5 bg-slate-50 rounded-lg px-3 py-2">
                    <MessageSquare className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 italic">{file.caption}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => window.open(file.public_url)}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" /> Скачать
                  </button>
                  {canDelete(file) && (
                    <button
                      onClick={() => deleteMutation.mutate(file.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Удалить
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
            className="max-h-[90vh] max-w-[90vw] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightboxUrl}
            download
            className="absolute bottom-6 right-6 bg-white/20 hover:bg-white/30 text-white rounded px-3 py-1.5 text-sm flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
            Скачать
          </a>
        </div>
      )}
    </div>
  )
}
