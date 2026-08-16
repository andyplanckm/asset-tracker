import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Auth from './components/Auth'
import LoadingScreen from './components/LoadingScreen'
import ResetPassword from './components/ResetPassword'
import { errorMessage, supabase } from './lib/supabase'

const AuthenticatedApp = lazy(() => import('./components/AuthenticatedApp'))
const SESSION_INITIALIZATION_TIMEOUT_MS = 15_000
const SESSION_INITIALIZATION_TIMEOUT_MESSAGE =
  '连接登录服务超时，请检查网络或在 Supabase 控制台恢复项目后重试'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializationError, setInitializationError] = useState('')
  const [initializationAttempt, setInitializationAttempt] = useState(0)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let isActive = true
    let initializationComplete = false

    const settleInitialSession = (nextSession: Session | null, nextError = '') => {
      if (!isActive || initializationComplete) return

      initializationComplete = true
      window.clearTimeout(initializationTimer)
      setSession(nextSession)
      setInitializationError(nextError)
      setLoading(false)
    }

    const initializationTimer = window.setTimeout(() => {
      settleInitialSession(null, SESSION_INITIALIZATION_TIMEOUT_MESSAGE)
    }, SESSION_INITIALIZATION_TIMEOUT_MS)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive || event === 'INITIAL_SESSION') return
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)

      if (!initializationComplete) {
        settleInitialSession(session)
        return
      }

      setSession(session)
      setInitializationError('')
      setLoading(false)
    })

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        settleInitialSession(data.session)
      } catch (error) {
        settleInitialSession(null, errorMessage(error, '登录状态加载失败，请检查网络后重试'))
      }
    }

    void initializeSession()

    return () => {
      isActive = false
      window.clearTimeout(initializationTimer)
      subscription.unsubscribe()
    }
  }, [initializationAttempt])

  const retryInitialization = () => {
    setLoading(true)
    setInitializationError('')
    setInitializationAttempt((attempt) => attempt + 1)
  }

  if (loading) {
    return <LoadingScreen message="正在确认登录状态" />
  }

  if (initializationError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section
          role="alert"
          className="w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-7 text-center shadow-xl shadow-slate-300/25 backdrop-blur-xl"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-500" aria-hidden="true">
            !
          </div>
          <h1 className="text-lg font-semibold text-slate-900">暂时无法加载登录状态</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{initializationError}</p>
          <button
            type="button"
            onClick={retryInitialization}
            className="mt-6 cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
          >
            重新连接
          </button>
        </section>
      </main>
    )
  }

  if (!session) {
    return <Auth />
  }

  if (passwordRecovery) {
    return <ResetPassword onComplete={() => setPasswordRecovery(false)} />
  }

  return (
    <Suspense fallback={<LoadingScreen message="正在加载资产数据" />}>
      <AuthenticatedApp key={session.user.id} userId={session.user.id} />
    </Suspense>
  )
}
