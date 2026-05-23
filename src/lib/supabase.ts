import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('请在 .env 文件中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  accounts: {
    id: string
    user_id: string
    name: string
    type: 'asset' | 'investment' | 'liability'
    icon: string
    created_at: string
  }
  balances: {
    id: string
    account_id: string
    user_id: string
    amount: number
    recorded_at: string
    created_at: string
  }
}
