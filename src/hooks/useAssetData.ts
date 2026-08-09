import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, supabase } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'

interface AssetDataState {
  userId: string
  accounts: Account[]
  balances: Balance[]
  loading: boolean
  error: string
}

const BALANCE_PAGE_SIZE = 500
const BALANCE_COLUMNS = 'id,account_id,user_id,amount,recorded_on,recorded_at,created_at'
const BACKGROUND_REFRESH_INTERVAL_MS = 60_000

function createInitialState(userId: string): AssetDataState {
  return {
    userId,
    accounts: [],
    balances: [],
    loading: true,
    error: '',
  }
}

async function fetchAllBalances(userId: string, isCurrentRequest: () => boolean): Promise<Balance[]> {
  const balances: Balance[] = []
  let from = 0

  while (isCurrentRequest()) {
    const { data, error } = await supabase
      .from('balances')
      .select(BALANCE_COLUMNS)
      .eq('user_id', userId)
      .order('recorded_on', { ascending: true })
      .order('recorded_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + BALANCE_PAGE_SIZE - 1)

    if (error) throw error
    if (!isCurrentRequest()) return balances

    const page = data ?? []
    balances.push(...page)

    if (page.length < BALANCE_PAGE_SIZE) break
    from += BALANCE_PAGE_SIZE
  }

  return balances
}

export function useAssetData(userId: string) {
  const [state, setState] = useState<AssetDataState>(() => createInitialState(userId))
  const requestId = useRef(0)
  const lastRefreshStartedAt = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    lastRefreshStartedAt.current = Date.now()
    const currentRequest = ++requestId.current
    const isCurrentRequest = () => currentRequest === requestId.current

    setState((previous) => previous.userId === userId
      ? { ...previous, loading: true, error: '' }
      : createInitialState(userId))

    try {
      const [accountsResult, balances] = await Promise.all([
        supabase
          .from('accounts')
          .select('id,user_id,name,type,icon,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        fetchAllBalances(userId, isCurrentRequest),
      ])

      if (accountsResult.error) throw accountsResult.error
      if (!isCurrentRequest()) return

      setState({
        userId,
        accounts: accountsResult.data,
        balances,
        loading: false,
        error: '',
      })
    } catch (error) {
      if (!isCurrentRequest()) return
      setState((previous) => ({
        ...(previous.userId === userId ? previous : createInitialState(userId)),
        loading: false,
        error: errorMessage(error, '资产数据加载失败，请稍后重试'),
      }))
    }
  }, [userId])

  useEffect(() => {
    void refresh()

    return () => {
      requestId.current += 1
    }
  }, [refresh])

  useEffect(() => {
    const refreshWhenReturning = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefreshStartedAt.current < BACKGROUND_REFRESH_INTERVAL_MS) return
      void refresh()
    }

    window.addEventListener('focus', refreshWhenReturning)
    document.addEventListener('visibilitychange', refreshWhenReturning)
    return () => {
      window.removeEventListener('focus', refreshWhenReturning)
      document.removeEventListener('visibilitychange', refreshWhenReturning)
    }
  }, [refresh])

  const visibleState = state.userId === userId ? state : createInitialState(userId)

  return {
    accounts: visibleState.accounts,
    balances: visibleState.balances,
    loading: visibleState.loading,
    error: visibleState.error,
    refresh,
  }
}
