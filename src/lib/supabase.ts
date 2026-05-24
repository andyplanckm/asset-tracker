import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('请在 .env 文件中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** 将 YYYY-MM-DD 日期字符串转为当天中午12点的 ISO 字符串 */
export function noonISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

/** 按天 upsert：同一天同一账户只保留一条记录，新数据替换旧数据 */
export async function upsertBalance(
  userId: string,
  accountId: string,
  amount: number,
  dateStr: string, // YYYY-MM-DD
) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0).toISOString()
  const end = new Date(y, m - 1, d, 23, 59, 59).toISOString()

  const { data: existing } = await supabase
    .from('balances')
    .select('id')
    .eq('account_id', accountId)
    .gte('recorded_at', start)
    .lte('recorded_at', end)
    .limit(1)

  if (existing && existing.length > 0) {
    await supabase
      .from('balances')
      .update({ amount, recorded_at: noonISO(dateStr) })
      .eq('id', existing[0].id)
  } else {
    await supabase.from('balances').insert({
      user_id: userId,
      account_id: accountId,
      amount,
      recorded_at: noonISO(dateStr),
    })
  }
}

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
