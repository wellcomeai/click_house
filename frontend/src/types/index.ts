export type UserRole = "admin" | "manager" | "foreman" | "worker"
export type ObjectStatus = "planning" | "active" | "frozen" | "completed"
export type ObjectType = "residential" | "commercial" | "infrastructure" | "renovation"
export type TaskPriority = "low" | "medium" | "high" | "critical"
export type TaskStatus = "new" | "in_progress" | "review" | "done"
export type TaskCategory = "supply" | "installation" | "documents" | "quality" | "safety" | "other"

export interface UserProfile {
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  position: string | null
  phone: string | null
  avatar_url: string | null
}

export interface User {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
  profile: UserProfile | null
}

export interface ConstructionObject {
  id: string
  name: string
  address: string | null
  object_type: ObjectType | null
  status: ObjectStatus
  start_date: string | null
  planned_end_date: string | null
  actual_end_date: string | null
  budget_planned: number | null
  budget_actual: number | null
  description: string | null
  lat: number | null
  lng: number | null
  manager_id: string | null
  foreman_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  title: string
  is_done: boolean
  order_index: number
}

export interface Task {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  category: TaskCategory | null
  object_id: string | null
  deadline: string | null
  creator_id: string
  assignee_id: string | null
  created_at: string
  updated_at: string
  checklist: ChecklistItem[]
}

export type FileType = "image" | "document"

export interface ObjectFile {
  id: string
  object_id: string
  task_id: string | null
  uploaded_by: string | null
  file_type: FileType
  original_name: string
  public_url: string
  size_bytes: number
  created_at: string
}

export interface ObjectComment {
  id: string
  object_id: string
  author_id: string | null
  author_name: string | null
  text: string
  created_at: string
  updated_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Agent {
  name: string
  display_name: string
  description: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

// Labels
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  foreman: "Прораб",
  worker: "Рабочий",
}

export const STATUS_LABELS: Record<ObjectStatus, string> = {
  planning: "Планирование",
  active: "Активный",
  frozen: "Заморожен",
  completed: "Завершён",
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнена",
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  supply: "Поставки",
  installation: "Монтаж",
  documents: "Документы",
  quality: "Качество",
  safety: "Безопасность",
  other: "Прочее",
}
