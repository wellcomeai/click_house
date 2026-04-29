import { useQuery } from "@tanstack/react-query"
import { Building2, CheckSquare, Clock, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { objectsApi } from "@/api/objects"
import { tasksApi } from "@/api/tasks"
import { useAuthStore } from "@/store/authStore"
import { ROLE_LABELS } from "@/types"

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const { user } = useAuthStore()

  const { data: objects = [] } = useQuery({
    queryKey: ["objects"],
    queryFn: objectsApi.getAll,
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: tasksApi.getMyTasks,
  })

  const activeObjects = objects.filter((o) => o.status === "active").length
  const pendingTasks = tasks.filter((t) => t.status !== "done").length
  const overdueTasks = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done"
  ).length
  const doneTasks = tasks.filter((t) => t.status === "done").length

  const fullName =
    user?.profile?.first_name
      ? `${user.profile?.last_name ?? ""} ${user.profile.first_name}`.trim()
      : user?.email ?? ""

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Добро пожаловать, {fullName}
        </h1>
        <p className="text-slate-500 mt-1">
          {user?.role ? ROLE_LABELS[user.role] : ""} · ClickHouse Иркутск
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Активных объектов"
          value={activeObjects}
          icon={Building2}
          color="text-blue-500"
        />
        <StatCard
          title="Моих задач в работе"
          value={pendingTasks}
          icon={CheckSquare}
          color="text-indigo-500"
        />
        <StatCard
          title="Выполнено задач"
          value={doneTasks}
          icon={Clock}
          color="text-green-500"
        />
        <StatCard
          title="Просрочено"
          value={overdueTasks}
          icon={AlertTriangle}
          color="text-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Последние задачи</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.slice(0, 5).length === 0 ? (
              <p className="text-slate-400 text-sm">Задач пока нет</p>
            ) : (
              <ul className="space-y-2">
                {tasks.slice(0, 5).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between py-1.5 border-b last:border-0"
                  >
                    <span className="text-sm text-slate-700 truncate max-w-[70%]">
                      {task.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        task.status === "done"
                          ? "bg-green-100 text-green-700"
                          : task.status === "in_progress"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {task.status === "done"
                        ? "Выполнена"
                        : task.status === "in_progress"
                        ? "В работе"
                        : task.status === "review"
                        ? "Проверка"
                        : "Новая"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Объекты</CardTitle>
          </CardHeader>
          <CardContent>
            {objects.slice(0, 5).length === 0 ? (
              <p className="text-slate-400 text-sm">Объектов пока нет</p>
            ) : (
              <ul className="space-y-2">
                {objects.slice(0, 5).map((obj) => (
                  <li
                    key={obj.id}
                    className="flex items-center justify-between py-1.5 border-b last:border-0"
                  >
                    <span className="text-sm text-slate-700 truncate max-w-[70%]">
                      {obj.name}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        obj.status === "active"
                          ? "bg-green-100 text-green-700"
                          : obj.status === "completed"
                          ? "bg-blue-100 text-blue-700"
                          : obj.status === "frozen"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {obj.status === "active"
                        ? "Активный"
                        : obj.status === "completed"
                        ? "Завершён"
                        : obj.status === "frozen"
                        ? "Заморожен"
                        : "Планирование"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
