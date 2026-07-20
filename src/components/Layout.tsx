import type { ReactNode } from 'react'
import { LogOut, WalletCards } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-200">
              <WalletCards className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">资产总览</h1>
              <p className="hidden text-[11px] text-slate-400 sm:block">清晰掌握每一笔财富</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <LogOut className="h-4 w-4 transition group-hover:-translate-x-0.5" aria-hidden="true" />
            <span className="hidden sm:inline">退出登录</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  )
}
