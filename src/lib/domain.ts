import type { Account, AccountType, Balance } from './types'

export interface DailySnapshot {
  date: string
  timestamp: number
  values: ReadonlyMap<string, number>
  records: ReadonlyMap<string, Balance>
  totalAssets: number
  totalInvestments: number
  totalLiabilities: number
  totalPnl: number
  netWorth: number
}

export interface ValueChange {
  amount: number
  percentage: number | null
}

export interface BalanceSummary {
  current: Balance | null
  previous: Balance | null
  change: ValueChange | null
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function localNoonTimestamp(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0).getTime()
}

export function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCompactMoney(value: number): string {
  const absolute = Math.abs(value)
  if (absolute >= 10_000) return `¥${(value / 10_000).toFixed(1).replace(/\.0$/, '')}万`
  return `¥${Math.round(value).toLocaleString('zh-CN')}`
}

export function formatSignedMoney(value: number): string {
  if (value === 0) return `¥${formatMoney(0)}`
  return `${value > 0 ? '+' : '-'}¥${formatMoney(Math.abs(value))}`
}

export function calculateChange(current: number, previous: number): ValueChange {
  return {
    amount: current - previous,
    percentage: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
  }
}

export function filterSnapshotsByDays(snapshots: DailySnapshot[], days: number | null): DailySnapshot[] {
  if (days === null || snapshots.length === 0) return snapshots
  const latestTimestamp = snapshots.at(-1)?.timestamp ?? 0
  const cutoff = latestTimestamp - (days - 1) * 24 * 60 * 60 * 1_000
  return snapshots.filter((snapshot) => snapshot.timestamp >= cutoff)
}

export function summarizeBalances(balances: Balance[]): BalanceSummary {
  const latestByDay = new Map<string, Balance>()
  for (const balance of [...balances].sort((left, right) => {
    const byDate = left.recorded_on.localeCompare(right.recorded_on)
    return byDate !== 0 ? byDate : left.recorded_at.localeCompare(right.recorded_at)
  })) {
    latestByDay.set(balance.recorded_on, balance)
  }

  const dailyBalances = [...latestByDay.values()]
  const current = dailyBalances.at(-1) ?? null
  const previous = dailyBalances.at(-2) ?? null

  return {
    current,
    previous,
    change: current && previous ? calculateChange(current.amount, previous.amount) : null,
  }
}

export function isValidAmount(type: AccountType, value: number): boolean {
  return Number.isFinite(value) && (type === 'pnl' || value >= 0)
}

/**
 * 构建每日账户快照。没有在当天更新的账户会沿用最后一次已知余额，
 * 因而历史净资产不会把未填写的账户错误地当成 0。
 */
export function buildDailySnapshots(accounts: Account[], balances: Balance[]): DailySnapshot[] {
  const accountTypes = new Map(accounts.map((account) => [account.id, account.type]))
  const balancesByDay = new Map<string, Balance[]>()

  const sortedBalances = [...balances].sort((left, right) => {
    const byDate = left.recorded_on.localeCompare(right.recorded_on)
    if (byDate !== 0) return byDate
    return left.recorded_at.localeCompare(right.recorded_at)
  })

  for (const balance of sortedBalances) {
    const dayBalances = balancesByDay.get(balance.recorded_on) ?? []
    dayBalances.push(balance)
    balancesByDay.set(balance.recorded_on, dayBalances)
  }

  const currentValues = new Map<string, number>()

  return [...balancesByDay.keys()].sort().map((date) => {
    const records = new Map<string, Balance>()
    for (const balance of balancesByDay.get(date) ?? []) {
      currentValues.set(balance.account_id, balance.amount)
      records.set(balance.account_id, balance)
    }

    let totalAssets = 0
    let totalInvestments = 0
    let totalLiabilities = 0
    let totalPnl = 0

    for (const [accountId, amount] of currentValues) {
      const type = accountTypes.get(accountId)
      if (type === 'asset') totalAssets += amount
      else if (type === 'investment') totalInvestments += amount
      else if (type === 'liability') totalLiabilities += amount
      else if (type === 'pnl') totalPnl += amount
    }

    return {
      date,
      timestamp: localNoonTimestamp(date),
      values: new Map(currentValues),
      records,
      totalAssets,
      totalInvestments,
      totalLiabilities,
      totalPnl,
      netWorth: totalAssets + totalInvestments - totalLiabilities,
    }
  })
}
