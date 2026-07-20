import { describe, expect, it } from 'vitest'
import { buildDailySnapshots, isValidAmount, localDateString, localNoonTimestamp } from './domain'
import type { Account, Balance } from './types'

const accounts: Account[] = [
  { id: 'cash', user_id: 'user', name: '现金', type: 'asset', icon: 'Wallet', created_at: '2026-07-01T00:00:00Z' },
  { id: 'debt', user_id: 'user', name: '信用卡', type: 'liability', icon: 'CreditCard', created_at: '2026-07-01T00:00:00Z' },
  { id: 'pnl', user_id: 'user', name: '投资盈亏', type: 'pnl', icon: 'TrendingUp', created_at: '2026-07-01T00:00:00Z' },
]

function balance(id: string, accountId: string, amount: number, recordedOn: string, hour = 4): Balance {
  return {
    id,
    account_id: accountId,
    user_id: 'user',
    amount,
    recorded_on: recordedOn,
    recorded_at: `${recordedOn}T${String(hour).padStart(2, '0')}:00:00Z`,
    created_at: `${recordedOn}T${String(hour).padStart(2, '0')}:00:00Z`,
  }
}

describe('local date helpers', () => {
  it('uses local calendar fields instead of UTC slicing', () => {
    expect(localDateString(new Date(2026, 6, 20, 0, 30))).toBe('2026-07-20')
    expect(new Date(localNoonTimestamp('2026-07-20')).getMonth()).toBe(6)
  })
})

describe('buildDailySnapshots', () => {
  it('carries the last known balance into later daily totals', () => {
    const snapshots = buildDailySnapshots(accounts, [
      balance('cash-1', 'cash', 1_000, '2026-07-01'),
      balance('debt-1', 'debt', 200, '2026-07-01'),
      balance('cash-2', 'cash', 1_200, '2026-07-02'),
    ])

    expect(snapshots).toHaveLength(2)
    expect(snapshots[1].values.get('debt')).toBe(200)
    expect(snapshots[1].records.has('debt')).toBe(false)
    expect(snapshots[1].netWorth).toBe(1_000)
  })

  it('keeps the latest legacy duplicate for an account and day', () => {
    const snapshots = buildDailySnapshots(accounts, [
      balance('early', 'cash', 100, '2026-07-01', 3),
      balance('late', 'cash', 150, '2026-07-01', 5),
    ])

    expect(snapshots[0].values.get('cash')).toBe(150)
    expect(snapshots[0].records.get('cash')?.id).toBe('late')
  })

  it('includes negative profit and loss without changing net worth', () => {
    const snapshots = buildDailySnapshots(accounts, [
      balance('cash-1', 'cash', 500, '2026-07-01'),
      balance('pnl-1', 'pnl', -80, '2026-07-01'),
    ])

    expect(snapshots[0].totalPnl).toBe(-80)
    expect(snapshots[0].netWorth).toBe(500)
    expect(isValidAmount('pnl', -80)).toBe(true)
    expect(isValidAmount('asset', -80)).toBe(false)
  })
})
