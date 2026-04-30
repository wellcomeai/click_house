import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { objectsApi } from "@/api/objects"
import { usersApi } from "@/api/users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ObjectStatus, ObjectType } from "@/types"

const OBJECT_TYPE_OPTIONS: { value: ObjectType; label: string }[] = [
  { value: "residential", label: "Жилой" },
  { value: "commercial", label: "Коммерческий" },
  { value: "infrastructure", label: "Инфраструктура" },
  { value: "renovation", label: "Реновация" },
]

const STATUS_OPTIONS: { value: ObjectStatus; label: string }[] = [
  { value: "planning", label: "Планирование" },
  { value: "active", label: "Активный" },
  { value: "frozen", label: "Заморожен" },
  { value: "completed", label: "Завершён" },
]

export function ObjectCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [objectType, setObjectType] = useState<ObjectType | "">("")
  const [objectStatus, setObjectStatus] = useState<ObjectStatus>("planning")
  const [startDate, setStartDate] = useState("")
  const [plannedEndDate, setPlannedEndDate] = useState("")
  const [budgetPlanned, setBudgetPlanned] = useState("")
  const [description, setDescription] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [managerId, setManagerId] = useState("")
  const [foremanId, setForemanId] = useState("")
  const [nameError, setNameError] = useState("")

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  })

  const managers = users.filter((u) => u.role === "manager")
  const foremen = users.filter((u) => u.role === "foreman")

  const getUserLabel = (u: (typeof users)[0]) => {
    const p = u.profile
    if (p?.last_name || p?.first_name) {
      return [p.last_name, p.first_name].filter(Boolean).join(" ")
    }
    return u.email
  }

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name,
        status: objectStatus,
      }
      if (address) payload.address = address
      if (objectType) payload.object_type = objectType
      if (startDate) payload.start_date = startDate
      if (plannedEndDate) payload.planned_end_date = plannedEndDate
      if (budgetPlanned) payload.budget_planned = parseFloat(budgetPlanned)
      if (description) payload.description = description
      if (lat) payload.lat = parseFloat(lat)
      if (lng) payload.lng = parseFloat(lng)
      if (managerId) payload.manager_id = managerId
      if (foremanId) payload.foreman_id = foremanId
      return objectsApi.create(payload as Parameters<typeof objectsApi.create>[0])
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["objects"] })
      navigate(`/objects/${created.id}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError("Название обязательно")
      return
    }
    setNameError("")
    mutate()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/objects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Новый объект</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Основные данные</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Название */}
            <div className="space-y-1">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введите название объекта"
              />
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            </div>

            {/* Адрес */}
            <div className="space-y-1">
              <Label htmlFor="address">Адрес</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Адрес объекта"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Тип */}
              <div className="space-y-1">
                <Label htmlFor="objectType">Тип объекта</Label>
                <select
                  id="objectType"
                  value={objectType}
                  onChange={(e) => setObjectType(e.target.value as ObjectType | "")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— не указан —</option>
                  {OBJECT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Статус */}
              <div className="space-y-1">
                <Label htmlFor="status">Статус</Label>
                <select
                  id="status"
                  value={objectStatus}
                  onChange={(e) => setObjectStatus(e.target.value as ObjectStatus)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Дата начала */}
              <div className="space-y-1">
                <Label htmlFor="startDate">Дата начала</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* Плановая дата завершения */}
              <div className="space-y-1">
                <Label htmlFor="plannedEndDate">Плановая дата завершения</Label>
                <Input
                  id="plannedEndDate"
                  type="date"
                  value={plannedEndDate}
                  onChange={(e) => setPlannedEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Бюджет */}
            <div className="space-y-1">
              <Label htmlFor="budget">Плановый бюджет (₽)</Label>
              <Input
                id="budget"
                type="number"
                min="0"
                value={budgetPlanned}
                onChange={(e) => setBudgetPlanned(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Описание */}
            <div className="space-y-1">
              <Label htmlFor="description">Описание</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Описание объекта..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Широта */}
              <div className="space-y-1">
                <Label htmlFor="lat">Широта</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="52.2855"
                />
              </div>

              {/* Долгота */}
              <div className="space-y-1">
                <Label htmlFor="lng">Долгота</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="104.2890"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Менеджер */}
              <div className="space-y-1">
                <Label htmlFor="manager">Менеджер</Label>
                <select
                  id="manager"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— не назначен —</option>
                  {managers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {getUserLabel(u)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Прораб */}
              <div className="space-y-1">
                <Label htmlFor="foreman">Прораб</Label>
                <select
                  id="foreman"
                  value={foremanId}
                  onChange={(e) => setForemanId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— не назначен —</option>
                  {foremen.map((u) => (
                    <option key={u.id} value={u.id}>
                      {getUserLabel(u)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">
                Ошибка при создании объекта. Попробуйте снова.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Создание..." : "Создать объект"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/objects">Отмена</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
