import apiClient from "./client"
import type { TokenResponse, User } from "@/types"

export const authApi = {
  register: (data: {
    email: string
    password: string
    first_name?: string
    last_name?: string
  }) => apiClient.post<TokenResponse>("/auth/register", data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<TokenResponse>("/auth/login", data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    apiClient.post<TokenResponse>("/auth/refresh", { refresh_token }).then((r) => r.data),

  logout: () => apiClient.post("/auth/logout"),

  getMe: () => apiClient.get<User>("/auth/me").then((r) => r.data),
}
