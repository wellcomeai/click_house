import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { usersApi } from "@/api/users"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ROLE_LABELS } from "@/types"

export function Profile() {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    position: "",
    phone: "",
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user?.profile) {
      setForm({
        first_name: user.profile.first_name ?? "",
        last_name: user.profile.last_name ?? "",
        middle_name: user.profile.middle_name ?? "",
        position: user.profile.position ?? "",
        phone: user.profile.phone ?? "",
      })
    }
  }, [user])

  const mutation = useMutation({
    mutationFn: (data: typeof form) => usersApi.updateProfile(user!.id, data),
    onSuccess: (updated) => {
      setUser(updated)
      queryClient.invalidateQueries({ queryKey: ["me"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Профиль</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Личные данные</CardTitle>
          <CardDescription>
            {user?.email} · {user?.role ? ROLE_LABELS[user.role] : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate(form)
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Фамилия</Label>
              <Input value={form.last_name} onChange={handleChange("last_name")} />
            </div>
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input value={form.first_name} onChange={handleChange("first_name")} />
            </div>
            <div className="space-y-2">
              <Label>Отчество</Label>
              <Input value={form.middle_name} onChange={handleChange("middle_name")} />
            </div>
            <div className="space-y-2">
              <Label>Должность</Label>
              <Input value={form.position} onChange={handleChange("position")} />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={handleChange("phone")}
                placeholder="+7 (XXX) XXX-XX-XX"
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
            {saved && (
              <p className="text-sm text-green-600">Изменения сохранены</p>
            )}
            {mutation.isError && (
              <p className="text-sm text-red-600">Ошибка при сохранении</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
