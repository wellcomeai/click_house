# Frontend — AI Context

## Стек
- React 18 + TypeScript (strict)
- Vite (сборка, dev-server proxy → localhost:8000)
- TailwindCSS + shadcn-совместимые компоненты
- TanStack Query v5 (серверный стейт)
- Zustand (клиентский стейт: auth, ui)
- React Router v6
- axios (API клиент с interceptors)

## Запуск
```bash
npm install
npm run dev        # dev на порту 5173, proxy → API :8000
npm run build      # сборка в dist/ (копируется в backend/static/)
```

## Структура src/
```
src/
├── api/
│   ├── client.ts       # axios instance + refresh token interceptor
│   ├── auth.ts
│   ├── objects.ts
│   ├── tasks.ts
│   ├── users.ts
│   ├── files.ts
│   ├── comments.ts
│   ├── taskComments.ts
│   ├── agents.ts       # SSE streaming для AI агентов
│   └── assistant.ts    # SSE streaming + REST для RAG ассистента
├── components/
│   ├── layout/         # Layout, Sidebar, Header
│   ├── objects/        # ObjectFiles, ObjectComments
│   ├── shared/         # ProtectedRoute, RoleGuard
│   └── ui/             # button, card, badge, input, select, label
├── pages/
│   ├── auth/           # Login, Register
│   ├── dashboard/      # Dashboard
│   ├── objects/        # ObjectsList, ObjectDetail, ObjectCreate
│   ├── tasks/          # MyTasks, TaskDetail
│   ├── profile/        # Profile
│   ├── agents/         # AgentChat (AI агенты)
│   ├── assistant/      # AssistantPage (RAG ассистент)
│   └── admin/          # Users (управление пользователями)
├── store/
│   ├── authStore.ts    # user, tokens, logout (persisted)
│   └── uiStore.ts      # sidebarOpen (persisted)
├── types/
│   └── index.ts        # все TypeScript типы + ROLE_LABELS и т.п.
└── utils/
    └── cn.ts           # clsx + tailwind-merge
```

## CSS переменные (index.css)
```css
--ch-green: #22b722        /* основной зелёный */
--ch-green-dark: #1a9a1a
--ch-green-xlight: #f0faf0
--ch-graphite: #3d3d3d     /* основной текст */
--ch-bg: #f2f4f7           /* фон страниц */
--ch-border: #e4e8ed
```

## API клиент (api/client.ts)
- Base URL из `VITE_API_URL` env или пустая строка (Vite proxy)
- Автоматически добавляет Bearer token из authStore
- При 401 — пробует refresh, при ошибке — redirect на /login
- НЕ используй axios для SSE стриминга — только нативный `fetch()`

## SSE стриминг (паттерн)
```typescript
const response = await fetch(`${BASE_URL}/endpoint`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
})
const reader = response.body!.getReader()
const decoder = new TextDecoder()
let buffer = ""
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split("\n")
  buffer = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    const data = line.slice(6).trim()
    if (data === "[DONE]") { onDone(); return }
    const parsed = JSON.parse(data)
    // handle parsed.type
  }
}
```

## Роутинг (App.tsx)
- `/login`, `/register` — публичные
- Всё под `<ProtectedRoute>` — проверяет accessToken
- `/agents`, `/agents/:name` — только admin/manager/foreman (`<RoleGuard>`)
- `/admin/users` — только admin
- `/assistant` — все роли

## Добавление нового раздела
1. Создать компонент в `pages/new_section/`
2. Добавить Route в `App.tsx`
3. Добавить NavItem в `components/layout/Sidebar.tsx`
4. Добавить API методы в `api/new_section.ts`
5. Типы добавить в `types/index.ts`

## TanStack Query паттерны
```typescript
// Запрос данных
const { data = [], isLoading } = useQuery({
  queryKey: ["key", id],
  queryFn: () => api.getById(id!),
  enabled: !!id,
})
// Мутация
const mutation = useMutation({
  mutationFn: (data) => api.create(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["key"] }),
})
```

## Важно для AssistantPage
- Это самый большой компонент (~800+ строк)
- Два основных вида: "knowledge" (база знаний) и "chat" (разговор)
- Сессии чата хранятся в БД, загружаются через `/assistant/sessions`
- Стриминг через `assistantApi.streamChat()` с SSE
- Скролл: при загрузке сессии → `scrollToBottom()`, кнопка вниз при scroll up
- НЕ фильтровать список файлов/заметок по тексту в строке поиска
  (строка поиска — только для отправки вопроса в AI)
