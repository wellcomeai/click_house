import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Upload, X, Download, FileText, Loader2 } from "lucide-react"
import { filesApi } from "@/api/files"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import type { ObjectFile } from "@/types"

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

interface Props {
  objectId: string
}

export function ObjectFiles({ objectId }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState("")

  const canUpload =
    user?.role === "admin" || user?.role === "manager" || user?.role === "foreman"

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["object-files", objectId],
    queryFn: () => filesApi.getByObject(objectId),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => filesApi.uploadToObject(objectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object-files", objectId] })
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
    uploadMutation.mutate(file)
  }

  const images = files.filter((f) => f.file_type === "image")
  const documents = files.filter((f) => f.file_type === "document")

  if (isLoading) return <p className="text-slate-400">Загрузка...</p>

  return (
    <div className="space-y-6">
      {canUpload && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Загрузить файл
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          {sizeError && <p className="text-sm text-red-500">{sizeError}</p>}
          {uploadMutation.isError && (
            <p className="text-sm text-red-500">Ошибка загрузки файла</p>
          )}
        </div>
      )}

      {/* Photos section */}
      {images.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Фотографии ({images.length})
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((file) => (
              <PhotoCard
                key={file.id}
                file={file}
                canDelete={
                  user?.role === "admin" ||
                  user?.role === "manager" ||
                  file.uploaded_by === user?.id
                }
                onOpen={() => setLightboxUrl(file.public_url)}
                onDelete={() => deleteMutation.mutate(file.id)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Documents section */}
      {documents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Документы ({documents.length})
          </h3>
          <div className="space-y-2">
            {documents.map((file) => (
              <DocumentRow
                key={file.id}
                file={file}
                canDelete={
                  user?.role === "admin" ||
                  user?.role === "manager" ||
                  file.uploaded_by === user?.id
                }
                onDelete={() => deleteMutation.mutate(file.id)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">Файлы не загружены</p>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white"
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

interface PhotoCardProps {
  file: ObjectFile
  canDelete: boolean
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
}

function PhotoCard({ file, canDelete, onOpen, onDelete, deleting }: PhotoCardProps) {
  return (
    <div className="relative group aspect-square rounded-md overflow-hidden border bg-slate-100">
      <img
        src={file.public_url}
        alt={file.original_name}
        className="w-full h-full object-cover cursor-pointer"
        onClick={onOpen}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
        <button
          className="p-1.5 bg-white/80 rounded text-slate-700 hover:bg-white"
          onClick={onOpen}
          title="Открыть"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        {canDelete && (
          <button
            className="p-1.5 bg-white/80 rounded text-red-600 hover:bg-white disabled:opacity-50"
            onClick={onDelete}
            disabled={deleting}
            title="Удалить"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

interface DocumentRowProps {
  file: ObjectFile
  canDelete: boolean
  onDelete: () => void
  deleting: boolean
}

function DocumentRow({ file, canDelete, onDelete, deleting }: DocumentRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md border bg-white hover:bg-slate-50 text-sm">
      <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate font-medium text-slate-800">
        {file.original_name}
      </span>
      <span className="text-slate-400 text-xs flex-shrink-0">{formatBytes(file.size_bytes)}</span>
      <span className="text-slate-400 text-xs flex-shrink-0">{formatDate(file.created_at)}</span>
      <button
        className="text-slate-500 hover:text-slate-700 flex-shrink-0"
        onClick={() => window.open(file.public_url)}
        title="Скачать"
      >
        <Download className="h-4 w-4" />
      </button>
      {canDelete && (
        <button
          className="text-red-400 hover:text-red-600 flex-shrink-0 disabled:opacity-50"
          onClick={onDelete}
          disabled={deleting}
          title="Удалить"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
