import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface PrivacyContextValue {
  amountsHidden: boolean
  toggleAmounts: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)
const STORAGE_KEY = 'asset-tracker-hide-amounts'

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [amountsHidden, setAmountsHidden] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(amountsHidden))
    } catch {
      // 隐私模式仍可在当前页面生效，即使浏览器禁用了本地存储。
    }
  }, [amountsHidden])

  const value = useMemo(() => ({
    amountsHidden,
    toggleAmounts: () => setAmountsHidden((hidden) => !hidden),
  }), [amountsHidden])

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrivacyMode(): PrivacyContextValue {
  const value = useContext(PrivacyContext)
  if (!value) throw new Error('usePrivacyMode 必须在 PrivacyProvider 内使用')
  return value
}
