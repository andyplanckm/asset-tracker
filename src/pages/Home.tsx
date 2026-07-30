import { useMemo } from 'react'
import Dashboard from '../components/Dashboard'
import AccountList from '../components/AccountList'
import { useAssetData } from '../hooks/useAssetData'
import { buildDailySnapshots } from '../lib/domain'
import type { Balance } from '../lib/types'

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
      <Dashboard accounts={accounts} snapshots={snapshots} loading={loading} />
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
