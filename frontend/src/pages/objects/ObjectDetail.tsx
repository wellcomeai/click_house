import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, MapPin, Calendar, DollarSign, Plus, X, User } from "lucide-react"
import { objectsApi } from "@/api/objects"
import { tasksApi } from "@/api/tasks"
import { usersApi } from "@/api/users"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ObjectFiles } from "@/components/objects/ObjectFiles"
import { ObjectComments } from "@/components/objects/ObjectComments"
import { useAuthStore } from "@/store/authStore"
import {
  STATUS_LABELS,
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  ROLE_LABELS,
  type ObjectStatus,
  type TaskStatus,
  type TaskPriority,
  type TaskCategory,
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

function UserNameBadge({ userId, label }: { userId: string; label: string }) {
  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => usersApi.getById(userId),
    enabled: !!userId,
  })

  const name = user?.profile?.first_name
    ? [user.profile.last_name, user.profile.first_name].filter(Boolean).join(" ")
    : user?.email ?? "..."

  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-4">
        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-sm font-medium text-slate-800">{name}</p>
          {user?.profile?.position && (
            <p className="text-xs text-slate-400">{user.profile.position}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ObjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>("tasks")
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    category: "" as TaskCategory | "",
    assignee_id: "",
    deadline: "",
  })

  const { user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()

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

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  })

  const createTaskMutation = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority,
        category: (taskForm.category as TaskCategory) || undefined,
        object_id: id,
        assignee_id: taskForm.assignee_id || undefined,
        deadline: taskForm.deadline || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-by-object", id] })
      setShowCreateTask(false)
      setTaskForm({
        title: "",
        description: "",
        priority: "medium",
        category: "",
        assignee_id: "",
        deadline: "",
      })
    },
  })

  if (isLoading) return <div className="text-slate-400">Загрузка...</div>
  if (!obj) return <div className="text-red-500">Объект не найден</div>

  const canCreateTask =
    currentUser?.role === "admin" ||
    (currentUser?.role === "foreman" && obj.foreman_id === currentUser?.id)

  const tasksByStatus = {
    new: tasks.filter((t) => t.status === "new"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    done: tasks.filter((t) => t.status === "done"),
  }

  const doneTasks = tasksByStatus.done.length
  const overdueTasks = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done"
  ).length

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
        {tasks.length > 0 && (
          <Card>
            <CardContent className="flex items-start gap-2 pt-4">
              <div>
                <p className="text-xs text-slate-500">Задачи</p>
                <p className="text-sm">
                  {tasks.length} всего · {doneTasks} выполнено
                  {overdueTasks > 0 && (
                    <span className="text-red-500"> · {overdueTasks} просрочено</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {(obj.manager_id || obj.foreman_id) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {obj.manager_id && (
            <UserNameBadge userId={obj.manager_id} label="Менеджер проекта" />
          )}
          {obj.foreman_id && (
            <UserNameBadge userId={obj.foreman_id} label="Прораб" />
          )}
        </div>
      )}

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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Задачи объекта ({tasks.length})
              </h2>
              {canCreateTask && (
                <Button size="sm" onClick={() => setShowCreateTask(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Создать задачу
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.entries(tasksByStatus) as [TaskStatus, typeof tasks][]).map(
                ([status, statusTasks]) => (
                  <div key={status}>
                    <h3 className="text-sm font-medium text-slate-500 mb-2">
                      {TASK_STATUS_LABELS[status]} ({statusTasks.length})
                    </h3>
                    <div className="space-y-2">
                      {statusTasks.map((task) => (
                        <Link key={task.id} to={`/tasks/${task.id}`}>
                          <div className="p-3 bg-white rounded-md border text-sm shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer">
                            <p className="font-medium text-slate-800 line-clamp-2">{task.title}</p>
                            <Badge
                              variant={PRIORITY_COLORS[task.priority] as any}
                              className="mt-1 text-xs"
                            >
                              {PRIORITY_LABELS[task.priority]}
                            </Badge>
                          </div>
                        </Link>
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

      {/* Create task modal */}
      {showCreateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#3d3d3d]">Новая задача</h2>
                <p className="text-sm text-slate-400">{obj.name}</p>
              </div>
              <button
                onClick={() => setShowCreateTask(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Название *</label>
              <input
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Введите название задачи"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Описание</label>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Описание задачи..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Priority + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Приоритет</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Категория</label>
                <select
                  value={taskForm.category}
                  onChange={(e) =>
                    setTaskForm((f) => ({
                      ...f,
                      category: e.target.value as TaskCategory | "",
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— не указана —</option>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Ответственный</label>
              <select
                value={taskForm.assignee_id}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, assignee_id: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— не назначен —</option>
                {users.map((u) => {
                  const name = u.profile?.first_name
                    ? `${u.profile.last_name ?? ""} ${u.profile.first_name}`.trim()
                    : u.email
                  return (
                    <option key={u.id} value={u.id}>
                      {name} ({ROLE_LABELS[u.role]}) — {u.email}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Deadline */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Срок выполнения</label>
              <input
                type="datetime-local"
                value={taskForm.deadline}
                onChange={(e) => setTaskForm((f) => ({ ...f, deadline: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Error */}
            {createTaskMutation.isError && (
              <p className="text-sm text-red-500">Ошибка при создании задачи. Попробуйте снова.</p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                onClick={() => createTaskMutation.mutate()}
                disabled={!taskForm.title.trim() || createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? "Создание..." : "Создать задачу"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateTask(false)}>
                Отмена
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
