import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, supabase } from '../lib/supabase'
import { withNetworkTimeout } from '../lib/network'
import type { Account, Balance } from '../lib/types'

interface AssetDataState {
  userId: string
  accounts: Account[]
  balances: Balance[]
  loading: boolean
  refreshing: boolean
  lastSyncedAt: number | null
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
    refreshing: false,
    lastSyncedAt: null,
    error: '',
  }
}

async function fetchAllBalances(userId: string, signal: AbortSignal): Promise<Balance[]> {
  const balances: Balance[] = []
  let from = 0

  while (!signal.aborted) {
    const { data, error } = await supabase
      .from('balances')
      .select(BALANCE_COLUMNS)
      .eq('user_id', userId)
      .order('recorded_on', { ascending: true })
      .order('recorded_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + BALANCE_PAGE_SIZE - 1)
      .abortSignal(signal)

    if (error) throw error
    signal.throwIfAborted()

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
  const activeRequest = useRef<AbortController | null>(null)
  const lastRefreshStartedAt = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    lastRefreshStartedAt.current = Date.now()
    const currentRequest = ++requestId.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const isCurrentRequest = () => currentRequest === requestId.current

    setState((previous) => previous.userId === userId
      ? { ...previous, loading: previous.lastSyncedAt === null, refreshing: previous.lastSyncedAt !== null, error: '' }
      : createInitialState(userId))

    try {
      const [accountsResult, balances] = await withNetworkTimeout((signal) => Promise.all([
        supabase
          .from('accounts')
          .select('id,user_id,name,type,icon,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .abortSignal(signal)
          .throwOnError(),
        fetchAllBalances(userId, signal),
      ]), controller.signal)
      if (!isCurrentRequest()) return

      setState({
        userId,
        accounts: accountsResult.data ?? [],
        balances,
        loading: false,
        refreshing: false,
        lastSyncedAt: Date.now(),
        error: '',
      })
    } catch (error) {
      if (!isCurrentRequest()) return
      setState((previous) => ({
        ...(previous.userId === userId ? previous : createInitialState(userId)),
        loading: false,
        refreshing: false,
        error: errorMessage(error, '资产数据加载失败，请稍后重试'),
      }))
    } finally {
      controller.abort()
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [userId])

  useEffect(() => {
    void refresh()

    return () => {
      requestId.current += 1
      activeRequest.current?.abort()
      activeRequest.current = null
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
    refreshing: visibleState.refreshing,
    lastSyncedAt: visibleState.lastSyncedAt,
    error: visibleState.error,
    refresh,
  }
}
