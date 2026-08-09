import { lazy, Suspense, useMemo } from 'react'
import AccountList from '../components/AccountList'
import { useAssetData } from '../hooks/useAssetData'
import { buildDailySnapshots } from '../lib/domain'
import type { Balance } from '../lib/types'

const Dashboard = lazy(() => import('../components/Dashboard'))

export default function Home({ userId }: { userId: string }) {
  const { accounts, balances, loading, error, refresh } = useAssetData(userId)
  const snapshots = useMemo(() => buildDailySnapshots(accounts, balances), [accounts, balances])
  const balancesByAccount = useMemo(() => {
    const grouped = new Map<string, Balance[]>()
    for (const balance of balances) {
      const accountBalances = grouped.get(balance.account_id) ?? []
      accountBalances.push(balance)
      grouped.set(balance.account_id, accountBalances)
    }
    return grouped
  }, [balances])

  if (error && !loading && accounts.length === 0 && balances.length === 0) {
    return (
      <section role="alert" className="rounded-[1.5rem] border border-red-100 bg-white px-5 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl font-bold text-red-500" aria-hidden="true">!</div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">暂时无法读取资产数据</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{error}。你的云端记录没有因此被删除，请重新连接后再试。</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-6 min-h-11 cursor-pointer rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
        >
          重新加载
        </button>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
          <button type="button" onClick={() => void refresh()} className="ml-2 cursor-pointer font-semibold underline underline-offset-2">
            重试
          </button>
        </div>
      )}
      <Suspense fallback={<DashboardFallback />}>
        <Dashboard
          accounts={accounts}
          balancesByAccount={balancesByAccount}
          snapshots={snapshots}
          loading={loading}
        />
      </Suspense>
      <AccountList
        userId={userId}
        accounts={accounts}
        balancesByAccount={balancesByAccount}
        snapshots={snapshots}
        loading={loading}
        onDataChanged={refresh}
      />
    </div>
  )
}

function DashboardFallback() {
  return (
    <section aria-label="资产概览加载中" aria-busy="true">
      <div className="mb-4 h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-64 animate-pulse rounded-[1.25rem] bg-slate-200 lg:col-span-5" />
        <div className="h-64 animate-pulse rounded-[1.25rem] bg-white lg:col-span-7" />
      </div>
    </section>
  )
}
