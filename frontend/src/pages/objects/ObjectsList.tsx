import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Plus, Building2, MapPin } from "lucide-react"
import { objectsApi } from "@/api/objects"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS, type ObjectStatus } from "@/types"

const STATUS_COLORS: Record<ObjectStatus, string> = {
  planning: "secondary",
  active: "success",
  frozen: "warning",
  completed: "default",
} as const

export function ObjectsList() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState("")
  const queryClient = useQueryClient()

  const { data: objects = [], isLoading } = useQuery({
    queryKey: ["objects"],
    queryFn: objectsApi.getAll,
  })

  const canCreate = user?.role === "admin" || user?.role === "manager"

  const filtered = objects.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.address ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Строительные объекты</h1>
        {canCreate && (
          <Button asChild>
            <Link to="/objects/new">
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Link>
          </Button>
        )}
      </div>

      <Input
        placeholder="Поиск по названию или адресу..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <p className="text-slate-400">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Объекты не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((obj) => (
            <Card key={obj.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{obj.name}</CardTitle>
                  <Badge variant={STATUS_COLORS[obj.status] as any}>
                    {STATUS_LABELS[obj.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {obj.address && (
                  <div className="flex items-start gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{obj.address}</span>
                  </div>
                )}
                {obj.description && (
                  <p className="text-sm text-slate-600 line-clamp-2">{obj.description}</p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  {obj.planned_end_date && (
                    <div>
                      <span className="font-medium">Срок:</span>{" "}
                      {new Date(obj.planned_end_date).toLocaleDateString("ru-RU")}
                    </div>
                  )}
                  {obj.budget_planned && (
                    <div>
                      <span className="font-medium">Бюджет:</span>{" "}
                      {Number(obj.budget_planned).toLocaleString("ru-RU")} ₽
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/objects/${obj.id}`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
