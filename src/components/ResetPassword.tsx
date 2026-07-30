import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react'
import { errorMessage, supabase } from '../lib/supabase'

interface Props {
  onComplete: () => void
}

export default function ResetPassword({ onComplete }: Props) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      setError('新密码至少需要 8 位。')
      return
    }
    if (password !== confirmation) {
      setError('两次输入的密码不一致。')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSaved(true)
      window.history.replaceState({}, document.title, window.location.pathname)
    } catch (updateError: unknown) {
      setError(errorMessage(updateError, '暂时无法更新密码，请重新打开重置链接后再试。'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-300/30 backdrop-blur-xl sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200">
            <WalletCards className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">设置新密码</h1>
          <p className="mt-2 text-sm text-slate-500">完成后即可继续进入资产总览</p>
        </div>

        {saved ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">密码已更新</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">新的登录密码已经生效。</p>
            <button
              type="button"
              onClick={onComplete}
              className="mt-7 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-200/70 transition hover:bg-blue-700"
            >
              继续进入
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordField
              id="new-password"
              label="新密码"
              value={password}
              onChange={(value) => { setPassword(value); setError('') }}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword((visible) => !visible)}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="确认新密码"
              value={confirmation}
              onChange={(value) => { setConfirmation(value); setError('') }}
              showPassword={showPassword}
              autoComplete="new-password"
            />

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-200/70 transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
            >
              {saving ? '更新中…' : '更新密码'}
            </button>
          </form>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          重置链接仅用于本次密码更新
        </p>
      </section>
    </main>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  showPassword: boolean
  onToggleVisibility?: () => void
  autoComplete: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
      </label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={8}
          required
          autoComplete={autoComplete}
          className={`w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-10 text-sm text-slate-800 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ${onToggleVisibility ? 'pr-11' : 'pr-4'}`}
          placeholder="至少 8 位密码"
        />
        {onToggleVisibility && (
          <button
            type="button"
            onClick={onToggleVisibility}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            {showPassword
              ? <EyeOff className="h-4 w-4" aria-hidden="true" />
              : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  )
}
