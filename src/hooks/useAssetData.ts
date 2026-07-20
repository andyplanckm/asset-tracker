import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, supabase } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'

interface AssetDataState {
  accounts: Account[]
  balances: Balance[]
  loading: boolean
  error: string
}

const initialState: AssetDataState = {
  accounts: [],
  balances: [],
  loading: true,
  error: '',
}

export function useAssetData(userId: string) {
  const [state, setState] = useState(initialState)
  const requestId = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    const currentRequest = ++requestId.current
    setState((previous) => ({ ...previous, loading: true, error: '' }))

    try {
      const [accountsResult, balancesResult] = await Promise.all([
        supabase
          .from('accounts')
          .select('id,user_id,name,type,icon,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('balances')
          .select('id,account_id,user_id,amount,recorded_on,recorded_at,created_at')
          .eq('user_id', userId)
          .order('recorded_on', { ascending: true })
          .order('recorded_at', { ascending: true }),
      ])

      if (accountsResult.error) throw accountsResult.error
      if (balancesResult.error) throw balancesResult.error
      if (currentRequest !== requestId.current) return

      setState({
        accounts: accountsResult.data,
        balances: balancesResult.data,
        loading: false,
        error: '',
      })
    } catch (error) {
      if (currentRequest !== requestId.current) return
      setState((previous) => ({
        ...previous,
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

  return { ...state, refresh }
}
