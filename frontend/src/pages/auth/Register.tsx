import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { HardHat } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { authApi } from "@/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function Register() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { setTokens } = useAuthStore()
  const navigate = useNavigate()

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const tokens = await authApi.register(form)
      setTokens(tokens.access_token, tokens.refresh_token)
      navigate("/dashboard")
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Ошибка регистрации")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <HardHat className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle>Регистрация</CardTitle>
          <CardDescription>Создайте аккаунт в платформе</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="last_name">Фамилия</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={handleChange("last_name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">Имя</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={handleChange("first_name")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@company.ru"
                value={form.email}
                onChange={handleChange("email")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль (мин. 8 символов)</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={handleChange("password")}
                required
                minLength={8}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-4">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              Войти
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
