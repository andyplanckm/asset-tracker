import { describe, expect, it } from 'vitest'
import { selectAccounts, type AccountSort } from './accountFilters'
import { getBalanceFreshness } from './domain'
import type { AccountWithBalance } from './types'

const accounts: AccountWithBalance[] = [
  { id: 'cash', name: '现金', type: 'asset', icon: 'Wallet', user_id: 'u', created_at: '', latest_balance: 0 },
  { id: 'loan', name: '房贷', type: 'liability', icon: 'Home', user_id: 'u', created_at: '', latest_balance: 50_000 },
  { id: 'new', name: '未记录', type: 'asset', icon: 'Wallet', user_id: 'u', created_at: '', latest_balance: null },
]
const freshness = new Map([
  ['cash', getBalanceFreshness('2026-10-18', '2026-10-19')],
  ['loan', getBalanceFreshness('2026-08-01', '2026-10-19')],
  ['new', getBalanceFreshness(null, '2026-10-19')],
])

describe('account browsing', () => {
  it.each<AccountSort>(['amount-desc', 'amount-asc'])('keeps missing balances last for %s without mutating input', (sort) => {
    const result = selectAccounts(accounts, freshness, { type: 'all', status: 'all', query: '', sort })
    expect(result.at(-1)?.id).toBe('new')
    expect(result[0].id).toBe(sort === 'amount-desc' ? 'loan' : 'cash')
    expect(accounts.map((account) => account.id)).toEqual(['cash', 'loan', 'new'])
  })

  it('combines type, attention and name filters', () => {
    const result = selectAccounts(accounts, freshness, { type: 'liability', status: 'attention', query: ' 房贷 ', sort: 'name' })
    expect(result.map((account) => account.id)).toEqual(['loan'])
    expect(selectAccounts(accounts, freshness, { type: 'asset', status: 'fresh', query: '', sort: 'name' }).map((account) => account.id)).toEqual(['cash'])
  })

  it('reviews missing balances first, then the oldest confirmation', () => {
    expect(selectAccounts(accounts, freshness, { type: 'all', status: 'attention', query: '', sort: 'oldest' }).map((account) => account.id)).toEqual(['new', 'loan'])
  })
})
