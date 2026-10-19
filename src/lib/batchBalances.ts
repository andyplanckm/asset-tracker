import { isValidAmount } from './domain'
import type { Account, Balance } from './types'

export interface BatchBalanceEntry {
  accountId: string
  amount: number
}

/** A historical edit must never borrow a balance recorded after its date. */
export function balanceOnOrBefore(balances: readonly Balance[], date: string): Balance | null {
  let result: Balance | null = null
  for (const balance of balances) {
    if (balance.recorded_on > date) continue
    if (!result || balance.recorded_on > result.recorded_on || (
      balance.recorded_on === result.recorded_on && balance.recorded_at > result.recorded_at
    )) result = balance
  }
  return result
}

export function fillMissingBalanceAmounts(
  accounts: readonly Account[],
  balancesByAccount: ReadonlyMap<string, readonly Balance[]>,
  date: string,
  amounts: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const result = { ...amounts }
  for (const account of accounts) {
    if (result[account.id]?.trim()) continue
    const balance = balanceOnOrBefore(balancesByAccount.get(account.id) ?? [], date)
    if (balance) result[account.id] = String(balance.amount)
  }
  return result
}

export function previewBatchBalances(
  accounts: readonly Account[],
  balancesByAccount: ReadonlyMap<string, readonly Balance[]>,
  date: string,
  entries: readonly BatchBalanceEntry[],
) {
  const records = new Map<string, Balance>()
  let existingOnDateCount = 0
  let overwriteCount = 0
  let newInSnapshotCount = 0
  let netWorthBefore = 0
  let netWorthAfter = 0
  const entriesByAccount = new Map(entries.map((entry) => [entry.accountId, entry.amount]))

  for (const account of accounts) {
    const before = balanceOnOrBefore(balancesByAccount.get(account.id) ?? [], date)
    if (before) records.set(account.id, before)
    const hasSameDayRecord = before?.recorded_on === date
    if (hasSameDayRecord) existingOnDateCount += 1

    const proposedAmount = entriesByAccount.get(account.id)
    const hasEntry = proposedAmount !== undefined && isValidAmount(account.type, proposedAmount)
    if (hasEntry && hasSameDayRecord) overwriteCount += 1
    const afterAmount = hasEntry ? proposedAmount : (before?.amount ?? 0)
    if (account.type === 'pnl') continue
    if (hasEntry && !before) newInSnapshotCount += 1
    const sign = account.type === 'liability' ? -1 : 1
    netWorthBefore += sign * (before?.amount ?? 0)
    netWorthAfter += sign * afterAmount
  }

  return {
    records,
    existingOnDateCount,
    overwriteCount,
    newInSnapshotCount,
    netWorthBefore,
    netWorthAfter,
    netWorthChange: netWorthAfter - netWorthBefore,
  }
}
