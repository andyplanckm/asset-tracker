import { useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Info, TrendingDown, TrendingUp } from 'lucide-react'
import { isValidAmount, localDateString, summarizeBalances } from '../lib/domain'
import { errorMessage, upsertBalance } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'
import Dialog from './ui/Dialog'
import Money from './ui/Money'

interface Props {
  userId: string
  account: Account
  balances: Balance[]
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function RecordBalanceModal({
  userId,
  account,
  balances,
  onClose,
  onSaved,
}: Props) {
  const summary = useMemo(() => summarizeBalances(balances), [balances])
  const balancesByDate = useMemo(
    () => [...balances].sort((left, right) => right.recorded_on.localeCompare(left.recorded_on)),
    [balances],
  )
  const [date, setDate] = useState(() => localDateString())
  const [amount, setAmount] = useState(() => {
    const latestOnOrBeforeToday = balancesByDate.find(
      (balance) => balance.recorded_on <= localDateString(),
    )
    return latestOnOrBeforeToday ? String(latestOnOrBeforeToday.amount) : ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const parsedAmount = Number(amount)
  const amountIsValid = amount !== '' && isValidAmount(account.type, parsedAmount)
  const existingOnDate = balancesByDate.find((balance) => balance.recorded_on === date)
  const previousBalance = balancesByDate.find((balance) => balance.recorded_on < date)
  const comparisonAmount = existingOnDate?.amount ?? previousBalance?.amount
  const delta = comparisonAmount !== undefined && amountIsValid ? parsedAmount - comparisonAmount : null

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    const suggestedBalance = balancesByDate.find(
      (balance) => balance.recorded_on <= nextDate,
    )
    setAmount(suggestedBalance ? String(suggestedBalance.amount) : '')
    setError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!amountIsValid) {
      setError(account.type === 'pnl' ? '请输入有效金额' : '余额不能为负数')
      return
    }
    setSaving(true)
    setError('')

    try {
      await upsertBalance(userId, account.id, parsedAmount, date)
      await onSaved()
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, '余额保存失败，请重试'))
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="更新账户余额"
      description={account.name}
      size="sm"
      showCloseButton={!saving}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            form="record-balance-form"
            disabled={saving || !amountIsValid || !date}
            className="min-h-11 cursor-pointer rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {saving ? '保存中…' : existingOnDate ? '更新当日记录' : '保存记录'}
          </button>
        </div>
      )}
    >
      <form id="record-balance-form" onSubmit={handleSave} className="space-y-5">
        {summary.current && (
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">上次记录</p>
                <Money value={summary.current.amount} className="mt-1 block text-lg font-bold text-slate-900" />
              </div>
              <p className="text-xs text-slate-500">{formatDisplayDate(summary.current.recorded_on)}</p>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="balance-amount" className="mb-1.5 block text-sm font-semibold text-slate-700">
            {account.type === 'pnl' ? '盈亏金额（可为负数）' : '当前余额'}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">¥</span>
            <input
              id="balance-amount"
              type="number"
              step="0.01"
              min={account.type === 'pnl' ? undefined : 0}
              value={amount}
              onChange={(event) => { setAmount(event.target.value); setError('') }}
              aria-invalid={amount !== '' && !amountIsValid}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-lg font-semibold tabular-nums text-slate-900 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="0.00"
              autoFocus
            />
          </div>
          {delta !== null && delta !== 0 && (
            <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${delta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {delta > 0
                ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
              较上次 <Money value={delta} signed />
            </p>
          )}
        </div>

        <div>
          <label htmlFor="balance-date" className="mb-1.5 block text-sm font-semibold text-slate-700">
            记录日期
          </label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="balance-date"
              type="date"
              value={date}
              onChange={(event) => handleDateChange(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {existingOnDate && (
          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>该日期已有记录，保存后会更新原有金额，不会新增重复记录。</p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}
