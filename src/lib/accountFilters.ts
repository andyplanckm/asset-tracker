import type { BalanceFreshness } from './domain'
import type { AccountType, AccountWithBalance } from './types'

export type AccountStatusFilter = 'all' | 'attention' | 'fresh' | 'missing'
export type AccountSort = 'amount-desc' | 'amount-asc' | 'name' | 'oldest'

export function selectAccounts(
  accounts: AccountWithBalance[],
  freshness: ReadonlyMap<string, BalanceFreshness>,
  options: { type: 'all' | AccountType; status: AccountStatusFilter; query: string; sort: AccountSort },
): AccountWithBalance[] {
  const query = options.query.trim().toLocaleLowerCase('zh-CN')
  const byName = (left: AccountWithBalance, right: AccountWithBalance) => (
    left.name.localeCompare(right.name, 'zh-CN', { numeric: true }) || left.id.localeCompare(right.id)
  )

  return accounts.filter((account) => {
    const status = freshness.get(account.id)?.status ?? 'missing'
    return (options.type === 'all' || account.type === options.type)
      && (!query || account.name.toLocaleLowerCase('zh-CN').includes(query))
      && (options.status === 'all'
        || (options.status === 'attention' ? status !== 'fresh' : status === options.status))
  }).sort((left, right) => {
    if (options.sort === 'name') return byName(left, right)
    if (options.sort === 'oldest') {
      const leftDate = freshness.get(left.id)?.recordedOn ?? ''
      const rightDate = freshness.get(right.id)?.recordedOn ?? ''
      return leftDate.localeCompare(rightDate) || byName(left, right)
    }
    // 未记录余额始终放最后；0 是有效余额，不能与缺失值混为一谈。
    if (left.latest_balance === null) return right.latest_balance === null ? byName(left, right) : 1
    if (right.latest_balance === null) return -1
    const difference = options.sort === 'amount-asc'
      ? left.latest_balance - right.latest_balance
      : right.latest_balance - left.latest_balance
    return difference || byName(left, right)
  })
}
