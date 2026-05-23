import { useState, useCallback } from 'react'
import Dashboard from '../components/Dashboard'
import AccountList from '../components/AccountList'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRecorded = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return (
    <div>
      <Dashboard refreshKey={refreshKey} />
      <AccountList onRecorded={handleRecorded} />
    </div>
  )
}
