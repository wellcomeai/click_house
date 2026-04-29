import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ProtectedRoute } from "@/components/shared/ProtectedRoute"
import { RoleGuard } from "@/components/shared/RoleGuard"
import { Layout } from "@/components/layout/Layout"

import { Login } from "@/pages/auth/Login"
import { Register } from "@/pages/auth/Register"
import { Dashboard } from "@/pages/dashboard/Dashboard"
import { ObjectsList } from "@/pages/objects/ObjectsList"
import { ObjectDetail } from "@/pages/objects/ObjectDetail"
import { MyTasks } from "@/pages/tasks/MyTasks"
import { Profile } from "@/pages/profile/Profile"
import { AgentChat } from "@/pages/agents/AgentChat"
import { AdminUsers } from "@/pages/admin/Users"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/objects" element={<ObjectsList />} />
              <Route path="/objects/:id" element={<ObjectDetail />} />
              <Route path="/tasks" element={<MyTasks />} />
              <Route path="/profile" element={<Profile />} />

              {/* Agents — admin, manager, foreman only */}
              <Route element={<RoleGuard roles={["admin", "manager", "foreman"]} />}>
                <Route path="/agents" element={<AgentChat />} />
                <Route path="/agents/:name" element={<AgentChat />} />
              </Route>

              {/* Admin only */}
              <Route element={<RoleGuard roles={["admin"]} />}>
                <Route path="/admin/users" element={<AdminUsers />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
