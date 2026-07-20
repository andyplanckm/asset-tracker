import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('请在 .env 文件中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

/** 将 YYYY-MM-DD 转为本地当天中午的 ISO 字符串，避免午夜附近的时区漂移。 */
export function noonISO(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0).toISOString()
}

export interface BalanceInput {
  accountId: string
  amount: number
}

/** 依赖 (account_id, recorded_on) 唯一约束，一次请求完成当日余额批量写入。 */
export async function upsertBalances(
  userId: string,
  entries: BalanceInput[],
  recordedOn: string,
): Promise<void> {
  if (entries.length === 0) return

  const rows = entries.map(({ accountId, amount }) => ({
    user_id: userId,
    account_id: accountId,
    amount,
    recorded_on: recordedOn,
    recorded_at: noonISO(recordedOn),
  }))

  const { error } = await supabase
    .from('balances')
    .upsert(rows, { onConflict: 'account_id,recorded_on' })

  if (error) throw error
}

export async function upsertBalance(
  userId: string,
  accountId: string,
  amount: number,
  recordedOn: string,
): Promise<void> {
  await upsertBalances(userId, [{ accountId, amount }], recordedOn)
}

export function errorMessage(error: unknown, fallback = '操作失败，请重试'): string {
  return error instanceof Error && error.message ? error.message : fallback
}
