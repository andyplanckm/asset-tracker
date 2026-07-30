import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, LoaderCircle, LogOut, WalletCards } from 'lucide-react'
import { usePrivacyMode } from '../contexts/PrivacyContext'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from './ui/Toast'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  const [signingOut, setSigningOut] = useState(false)
  const { amountsHidden, toggleAmounts } = usePrivacyMode()
  const { showToast } = useToast()

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      showToast({
        variant: 'error',
        title: '退出失败',
        message: errorMessage(error, '暂时无法退出，请稍后重试'),
      })
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen min-w-0">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 min-w-0 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-200">
              <WalletCards className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">资产总览</h1>
              <p className="hidden text-[11px] text-slate-400 sm:block">清晰掌握每一笔财富</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleAmounts}
              aria-label={amountsHidden ? '显示金额' : '隐藏金额'}
              title={amountsHidden ? '显示金额' : '隐藏金额'}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              {amountsHidden
                ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-label="退出登录"
              className="group flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-wait disabled:opacity-60"
            >
              {signingOut
                ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <LogOut className="h-4 w-4 transition group-hover:-translate-x-0.5" aria-hidden="true" />}
              <span className="hidden sm:inline">{signingOut ? '退出中…' : '退出登录'}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-7xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  )
}
