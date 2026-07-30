import { describe, expect, it } from 'vitest'
import {
  buildDailySnapshots,
  calculateChange,
  filterSnapshotsByDays,
  isValidAmount,
  localDateString,
  localNoonTimestamp,
  summarizeBalances,
} from './domain'
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

describe('financial summaries', () => {
  it('calculates signed amount and percentage changes', () => {
    expect(calculateChange(1_250, 1_000)).toEqual({ amount: 250, percentage: 25 })
    expect(calculateChange(100, 0)).toEqual({ amount: 100, percentage: null })
  })

  it('summarizes the latest distinct balance days', () => {
    const summary = summarizeBalances([
      balance('first', 'cash', 100, '2026-07-01'),
      balance('same-day-latest', 'cash', 120, '2026-07-01', 8),
      balance('second', 'cash', 150, '2026-07-02'),
    ])

    expect(summary.current?.amount).toBe(150)
    expect(summary.previous?.amount).toBe(120)
    expect(summary.change?.amount).toBe(30)
  })

  it('filters snapshots relative to the most recent recorded day', () => {
    const snapshots = buildDailySnapshots(accounts, [
      balance('old', 'cash', 100, '2026-01-01'),
      balance('recent', 'cash', 200, '2026-07-01'),
      balance('latest', 'cash', 300, '2026-07-20'),
    ])

    expect(filterSnapshotsByDays(snapshots, 30).map((snapshot) => snapshot.date)).toEqual([
      '2026-07-01',
      '2026-07-20',
    ])
    expect(filterSnapshotsByDays(snapshots, null)).toHaveLength(3)
  })
})
