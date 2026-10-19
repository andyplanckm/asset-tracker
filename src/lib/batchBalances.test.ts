import { describe, expect, it } from 'vitest'
import { balanceOnOrBefore, fillMissingBalanceAmounts, previewBatchBalances } from './batchBalances'
import type { Account, Balance } from './types'

const accounts: Account[] = [
  { id: 'cash', user_id: 'user', name: '现金', type: 'asset', icon: 'Wallet', created_at: '2026-01-01T00:00:00Z' },
  { id: 'debt', user_id: 'user', name: '信用卡', type: 'liability', icon: 'CreditCard', created_at: '2026-01-01T00:00:00Z' },
  { id: 'pnl', user_id: 'user', name: '盈亏', type: 'pnl', icon: 'TrendingUp', created_at: '2026-01-01T00:00:00Z' },
  { id: 'investment', user_id: 'user', name: '投资', type: 'investment', icon: 'Coins', created_at: '2026-01-01T00:00:00Z' },
]

function balance(accountId: string, amount: number, day: string, hour = '04'): Balance {
  return {
    id: `${accountId}-${day}-${hour}`,
    account_id: accountId,
    user_id: 'user',
    amount,
    recorded_on: day,
    recorded_at: `${day}T${hour}:00:00Z`,
    created_at: `${day}T${hour}:00:00Z`,
  }
}

describe('historical batch balance prefilling', () => {
  it('never uses a future balance when backfilling an earlier date', () => {
    const balances = [balance('cash', 900, '2026-10-19'), balance('cash', 100, '2026-10-01')]
    expect(balanceOnOrBefore(balances, '2026-10-10')?.amount).toBe(100)
    expect(balanceOnOrBefore(balances, '2026-09-30')).toBeNull()
    expect(balances[0].amount).toBe(900)
  })

  it('selects the latest duplicate on the requested day regardless of input order', () => {
    const balances = [
      balance('cash', 150, '2026-10-10', '10'),
      balance('cash', 100, '2026-10-10', '02'),
      balance('cash', 900, '2026-10-11'),
    ]
    expect(balanceOnOrBefore(balances, '2026-10-10')?.amount).toBe(150)
  })

  it('preserves typed zero, negative pnl and invalid input while only filling blanks', () => {
    const history = new Map([
      ['cash', [balance('cash', 500, '2026-10-01')]],
      ['debt', [balance('debt', 200, '2026-10-01')]],
      ['pnl', [balance('pnl', 50, '2026-10-01')]],
      ['investment', [balance('investment', 300, '2026-10-01')]],
    ])
    const typed = { cash: '0', debt: '', pnl: '-20', investment: '-10' }
    expect(fillMissingBalanceAmounts(accounts, history, '2026-10-02', typed)).toEqual({
      cash: '0', debt: '200', pnl: '-20', investment: '-10',
    })
    expect(typed.debt).toBe('')
  })

  it('leaves future-only and missing accounts blank instead of assuming zero', () => {
    const history = new Map([['cash', [balance('cash', 500, '2026-10-19')]]])
    expect(fillMissingBalanceAmounts(accounts, history, '2026-10-01')).toEqual({})
    expect(fillMissingBalanceAmounts(accounts, history, '')).toEqual({})
  })
})

describe('batch net worth and overwrite preview', () => {
  it('treats debt repayment as a net worth increase and excludes pnl', () => {
    const history = new Map([
      ['cash', [balance('cash', 1_000, '2026-10-01')]],
      ['debt', [balance('debt', 200, '2026-10-01')]],
      ['pnl', [balance('pnl', 500, '2026-10-01')]],
    ])
    const result = previewBatchBalances(accounts, history, '2026-10-10', [
      { accountId: 'debt', amount: 150 },
      { accountId: 'pnl', amount: -2_000 },
    ])
    expect(result.netWorthBefore).toBe(800)
    expect(result.netWorthAfter).toBe(850)
    expect(result.netWorthChange).toBe(50)
    expect(result.newInSnapshotCount).toBe(0)
    expect(result.overwriteCount).toBe(0)
  })

  it('counts only entered accounts as overwrites while exposing all existing daily records', () => {
    const history = new Map([
      ['cash', [balance('cash', 100, '2026-10-10', '02'), balance('cash', 120, '2026-10-10', '10')]],
      ['debt', [balance('debt', 20, '2026-10-10')]],
      ['investment', [balance('investment', 300, '2026-10-09')]],
    ])
    const result = previewBatchBalances(accounts, history, '2026-10-10', [
      { accountId: 'cash', amount: 130 },
      { accountId: 'investment', amount: 320 },
    ])
    expect(result.existingOnDateCount).toBe(2)
    expect(result.overwriteCount).toBe(1)
    expect(result.netWorthBefore).toBe(400)
    expect(result.netWorthAfter).toBe(430)
  })

  it('identifies newly included accounts without leaking future balances into history', () => {
    const history = new Map([
      ['cash', [balance('cash', 999, '2026-10-19')]],
      ['debt', [balance('debt', 888, '2026-10-19')]],
    ])
    const result = previewBatchBalances(accounts, history, '2026-10-10', [
      { accountId: 'cash', amount: 100 },
      { accountId: 'debt', amount: 20 },
      { accountId: 'pnl', amount: -500 },
    ])
    expect(result.netWorthBefore).toBe(0)
    expect(result.netWorthAfter).toBe(80)
    expect(result.newInSnapshotCount).toBe(2)
    expect(result.records.size).toBe(0)
    expect(result.overwriteCount).toBe(0)
  })

  it('does not include invalid inputs or unknown accounts in financial totals', () => {
    const history = new Map([['cash', [balance('cash', 100, '2026-10-10')]]])
    const result = previewBatchBalances(accounts, history, '2026-10-10', [
      { accountId: 'cash', amount: -1 },
      { accountId: 'debt', amount: Number.NaN },
      { accountId: 'investment', amount: Number.POSITIVE_INFINITY },
      { accountId: 'unknown', amount: 999 },
    ])
    expect(result.netWorthAfter).toBe(100)
    expect(result.overwriteCount).toBe(0)
    expect(result.newInSnapshotCount).toBe(0)
  })
})
