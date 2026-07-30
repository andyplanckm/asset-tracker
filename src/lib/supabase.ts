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
  if (!(error instanceof Error) || !error.message) return fallback

  const message = error.message.toLowerCase()
  if (message.includes('invalid login credentials')) return '邮箱或密码不正确，请重新输入'
  if (message.includes('email not confirmed')) return '邮箱尚未验证，请先查看确认邮件'
  if (message.includes('user already registered')) return '该邮箱已经注册，请直接登录'
  if (message.includes('password should be at least')) return '密码至少需要 6 位'
  if (message.includes('rate limit') || message.includes('too many requests')) return '操作过于频繁，请稍后再试'
  if (message.includes('failed to fetch') || message.includes('network')) return '网络连接失败，请检查网络后重试'
  if (message.includes('row-level security') || message.includes('permission denied')) return '当前账户没有执行此操作的权限'
  if (message.includes('duplicate key') || message.includes('already exists')) return '这条记录已经存在，请刷新后重试'
  if (message.includes('jwt') || message.includes('token')) return '登录状态已过期，请重新登录'

  return fallback
}
