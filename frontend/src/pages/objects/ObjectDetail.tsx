import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, MapPin, Calendar, DollarSign } from "lucide-react"
import { objectsApi } from "@/api/objects"
import { tasksApi } from "@/api/tasks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ObjectFiles } from "@/components/objects/ObjectFiles"
import { ObjectComments } from "@/components/objects/ObjectComments"
import {
  STATUS_LABELS,
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  type ObjectStatus,
  type TaskStatus,
  type TaskPriority,
} from "@/types"

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "secondary",
  medium: "outline",
  high: "warning",
  critical: "destructive",
} as const

type Tab = "tasks" | "files" | "journal"

const TABS: { key: Tab; label: string }[] = [
  { key: "tasks", label: "Задачи" },
  { key: "files", label: "Файлы и фото" },
  { key: "journal", label: "Журнал" },
]

export function ObjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>("tasks")

  const { data: obj, isLoading } = useQuery({
    queryKey: ["object", id],
    queryFn: () => objectsApi.getById(id!),
    enabled: !!id,
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-by-object", id],
    queryFn: () => tasksApi.getByObject(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="text-slate-400">Загрузка...</div>
  if (!obj) return <div className="text-red-500">Объект не найден</div>

  const tasksByStatus = {
    new: tasks.filter((t) => t.status === "new"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    done: tasks.filter((t) => t.status === "done"),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/objects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{obj.name}</h1>
          <Badge>{STATUS_LABELS[obj.status as ObjectStatus]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {obj.address && (
          <Card>
            <CardContent className="flex items-start gap-2 pt-4">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Адрес</p>
                <p className="text-sm">{obj.address}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {obj.planned_end_date && (
          <Card>
            <CardContent className="flex items-start gap-2 pt-4">
              <Calendar className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Плановый срок</p>
                <p className="text-sm">
                  {new Date(obj.planned_end_date).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {obj.budget_planned && (
          <Card>
            <CardContent className="flex items-start gap-2 pt-4">
              <DollarSign className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Бюджет</p>
                <p className="text-sm">
                  {Number(obj.budget_planned).toLocaleString("ru-RU")} ₽
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {obj.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Описание</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{obj.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div>
        <div className="flex border-b border-slate-200 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "tasks" && (
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-3">
              Задачи объекта ({tasks.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.entries(tasksByStatus) as [TaskStatus, typeof tasks][]).map(
                ([status, statusTasks]) => (
                  <div key={status}>
                    <h3 className="text-sm font-medium text-slate-500 mb-2">
                      {TASK_STATUS_LABELS[status]} ({statusTasks.length})
                    </h3>
                    <div className="space-y-2">
                      {statusTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 bg-white rounded-md border text-sm shadow-sm"
                        >
                          <p className="font-medium text-slate-800 line-clamp-2">{task.title}</p>
                          <Badge
                            variant={PRIORITY_COLORS[task.priority] as any}
                            className="mt-1 text-xs"
                          >
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {activeTab === "files" && <ObjectFiles objectId={id!} />}

        {activeTab === "journal" && <ObjectComments objectId={id!} />}
      </div>
    </div>
  )
}
