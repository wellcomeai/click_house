import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { authApi } from "@/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { setTokens } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const tokens = await authApi.login({ email, password })
      setTokens(tokens.access_token, tokens.refresh_token)
      navigate("/dashboard")
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Ошибка авторизации")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center"
      style={{
        backgroundImage: "url('/bg-login.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center right",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Subtle left-side gradient to help readability without hiding the image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)",
        }}
      />

      {/* Glass card — positioned left-center */}
      <div
        className="relative ml-12 lg:ml-20 xl:ml-28 w-full max-w-sm rounded-2xl p-8 flex flex-col gap-5"
        style={{
          background: "rgba(255, 255, 255, 0.62)",
          backdropFilter: "blur(18px) saturate(1.4)",
          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
          border: "1px solid rgba(255, 255, 255, 0.85)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.10), inset 0 0 0 0.5px rgba(255,255,255,0.6)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="8" width="24" height="18" rx="2" fill="#1a5fa5" fillOpacity="0.15" stroke="#1a5fa5" strokeWidth="1.5"/>
              <path d="M8 8V5a6 6 0 0 1 12 0v3" stroke="#1a5fa5" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="11" y="14" width="6" height="7" rx="1" fill="#1a5fa5" fillOpacity="0.7"/>
            </svg>
            <span className="text-slate-800 font-semibold text-base tracking-tight">
              ClickHouse <span className="text-blue-600">Иркутск</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Добро пожаловать</h1>
          <p className="text-sm text-slate-500">Войдите в корпоративную платформу</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-slate-700 text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@company.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/70 border-white/80 focus:bg-white/90 transition-colors placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
              Пароль
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/70 border-white/80 focus:bg-white/90 transition-colors"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50/80 border border-red-200 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Вход..." : "Войти"}
          </Button>
        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-slate-500">
          Нет аккаунта?{" "}
          <Link
            to="/register"
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
