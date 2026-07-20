import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, WalletCards } from 'lucide-react'
import { errorMessage, supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setFeedback(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setFeedback({ type: 'success', message: '注册成功！请检查邮箱确认，或直接登录。' })
        setIsSignUp(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error: unknown) {
      setFeedback({ type: 'error', message: errorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white/85 p-6 shadow-2xl shadow-slate-300/30 backdrop-blur-xl sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200">
            <WalletCards className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">资产总览</h1>
          <p className="mt-2 text-sm text-slate-400">让每一笔财富都有迹可循</p>
        </div>

        <h2 className="mb-6 text-lg font-semibold text-slate-800">
          {isSignUp ? '创建账号' : '登录'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-slate-600">邮箱</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-10 pr-4 text-sm text-slate-800 transition placeholder:text-slate-300 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="your@email.com"
                autoComplete="email"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-slate-600">密码</label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-10 pr-4 text-sm text-slate-800 transition placeholder:text-slate-300 hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="至少 6 位密码"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={6}
              />
            </div>
          </div>

          {feedback && (
            <p role="status" className={`rounded-xl px-3 py-2.5 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {feedback.message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200/70 transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
          >
            {loading ? '处理中...' : isSignUp ? '注册' : '登录'}
            {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-400">
          {isSignUp ? '已有账号？' : '没有账号？'}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setFeedback(null) }}
            className="ml-1 cursor-pointer font-semibold text-blue-600 hover:text-blue-700"
          >
            {isSignUp ? '去登录' : '去注册'}
          </button>
        </p>
      </div>
    </div>
  )
}
