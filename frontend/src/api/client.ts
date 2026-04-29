import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"
import { useAuthStore } from "@/store/authStore"

const BASE_URL = import.meta.env.VITE_API_URL || ""

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
})

// Request: inject auth token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response: handle 401 with token refresh
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

function processQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token))
  refreshQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState()
    if (!refreshToken) {
      logout()
      window.location.href = "/login"
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(apiClient(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      setTokens(data.access_token, data.refresh_token)
      processQueue(data.access_token)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return apiClient(original)
    } catch {
      logout()
      window.location.href = "/login"
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default apiClient
