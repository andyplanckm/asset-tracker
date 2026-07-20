import Dashboard from '../components/Dashboard'
import AccountList from '../components/AccountList'
import { useAssetData } from '../hooks/useAssetData'

export default function Home({ userId }: { userId: string }) {
  const { accounts, balances, loading, error, refresh } = useAssetData(userId)

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          <button type="button" onClick={() => void refresh()} className="ml-2 font-medium underline cursor-pointer">
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
