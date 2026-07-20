import Dashboard from '../components/Dashboard'
import AccountList from '../components/AccountList'
import { useAssetData } from '../hooks/useAssetData'

export default function Home({ userId }: { userId: string }) {
  const { accounts, balances, loading, error, refresh } = useAssetData(userId)

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
      <Dashboard accounts={accounts} balances={balances} loading={loading} />
      <AccountList
        userId={userId}
        accounts={accounts}
        balances={balances}
        loading={loading}
        onDataChanged={refresh}
      />
    </div>
  )
}
