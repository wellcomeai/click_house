import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckSquare, Clock, AlertCircle } from "lucide-react"
import { tasksApi } from "@/api/tasks"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

export function MyTasks() {
  const { user } = useAuthStore()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const queryClient = useQueryClient()

  const canViewAll = user?.role === "admin" || user?.role === "manager"

  const { data: myTasks = [], isLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: tasksApi.getMyTasks,
  })

  const { data: allTasks = [] } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: tasksApi.getAllTasks,
    enabled: canViewAll,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] })
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] })
    },
  })

  const tasks = canViewAll && statusFilter === "all" && priorityFilter === "all"
    ? allTasks
    : myTasks

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
    return true
  })

  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    new: "in_progress",
    in_progress: "review",
    review: "done",
    done: null,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          {canViewAll ? "Все задачи" : "Мои задачи"}
        </h1>
        <div className="text-sm text-slate-500">{filtered.length} задач</div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {(Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Приоритет" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все приоритеты</SelectItem>
            {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-slate-400">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Задач не найдено</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <Card key={task.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-start gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{task.title}</span>
                    <Badge variant={PRIORITY_COLORS[task.priority] as any} className="text-xs">
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                    <Badge variant={STATUS_COLORS[task.status] as any} className="text-xs">
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                    {task.category && (
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[task.category]}
                      </Badge>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {task.deadline && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      Срок: {new Date(task.deadline).toLocaleDateString("ru-RU")}
                      {new Date(task.deadline) < new Date() && task.status !== "done" && (
                        <span className="text-red-500 flex items-center gap-0.5">
                          <AlertCircle className="h-3 w-3" />
                          Просрочена
                        </span>
                      )}
                    </div>
                  )}

                  {task.checklist.length > 0 && (
                    <div className="mt-2 text-xs text-slate-400">
                      Чеклист:{" "}
                      {task.checklist.filter((i) => i.is_done).length}/{task.checklist.length}
                    </div>
                  )}
                </div>

                {task.status !== "done" && nextStatus[task.status] && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStatus.isPending}
                    onClick={() =>
                      updateStatus.mutate({
                        id: task.id,
                        status: nextStatus[task.status]!,
                      })
                    }
                  >
                    {task.status === "new"
                      ? "Начать"
                      : task.status === "in_progress"
                      ? "На проверку"
                      : "Завершить"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
