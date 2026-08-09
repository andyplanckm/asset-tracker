import { useMemo, useState, type FormEvent } from 'react'
import { Calendar, Copy, Eraser, Info } from 'lucide-react'
import { isValidAmount, localDateString } from '../lib/domain'
import { AccountIcon } from '../lib/icons'
import { errorMessage, upsertBalances } from '../lib/supabase'
import type { AccountType, AccountWithBalance } from '../lib/types'
import Dialog from './ui/Dialog'
import Money from './ui/Money'

interface Props {
  userId: string
  accounts: AccountWithBalance[]
  prefillLatest?: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}

const sections: {
  type: AccountType
  label: string
  color: string
}[] = [
  { type: 'asset', label: '灵活取用', color: 'bg-emerald-50 text-emerald-700' },
  { type: 'investment', label: '投资资产', color: 'bg-amber-50 text-amber-700' },
  { type: 'liability', label: '负债账户', color: 'bg-rose-50 text-rose-700' },
  { type: 'pnl', label: '投资盈亏', color: 'bg-violet-50 text-violet-700' },
]

export default function BatchRecordModal({
  userId,
  accounts,
  prefillLatest = false,
  onClose,
  onSaved,
}: Props) {
  const today = localDateString()
  const [date, setDate] = useState(today)
  const [amounts, setAmounts] = useState<Record<string, string>>(() => (
    prefillLatest ? getLatestAmounts(accounts) : {}
  ))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dateError = !date
    ? '请选择记录日期'
    : date > today
      ? '记录日期不能晚于今天'
      : ''

  const validationErrors = useMemo(() => {
    const errors = new Map<string, string>()
    for (const account of accounts) {
      const rawValue = amounts[account.id]
      if (rawValue === undefined || rawValue === '') continue
      const amount = Number(rawValue)
      if (!isValidAmount(account.type, amount)) {
        errors.set(
          account.id,
          account.type === 'pnl' ? '请输入有效数字' : '余额不能为负数',
        )
      }
    }
    return errors
  }, [accounts, amounts])

  const entries = useMemo(() => accounts.flatMap((account) => {
    const rawValue = amounts[account.id]
    if (rawValue === undefined || rawValue === '' || validationErrors.has(account.id)) return []
    return [{ accountId: account.id, amount: Number(rawValue) }]
  }), [accounts, amounts, validationErrors])

  const fillLatestBalances = () => {
    setAmounts(getLatestAmounts(accounts))
    setError('')
  }

  const clearAmounts = () => {
    setAmounts({})
    setError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (dateError) {
      setError(dateError)
      return
    }
    if (validationErrors.size > 0) {
      setError(`有 ${validationErrors.size} 个金额需要修正，尚未保存任何记录。`)
      return
    }
    if (entries.length === 0) {
      setError('请至少填写一个账户金额')
      return
    }
    setSaving(true)
    setError('')

    try {
      await upsertBalances(userId, entries, date)
      await onSaved()
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, '批量保存失败，请重试'))
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={prefillLatest ? '确认待更新账户' : '集中更新余额'}
      description={prefillLatest
        ? '已带入最近余额；空白账户需要填写。'
        : '只保存已填写的账户。'}
      size="lg"
      showCloseButton={!saving}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      contentClassName="py-4"
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            将更新 <span className="font-semibold text-slate-800">{entries.length}</span> / {accounts.length} 个账户
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
              form="batch-record-form"
              disabled={saving || entries.length === 0 || validationErrors.size > 0 || Boolean(dateError)}
              className="min-h-11 cursor-pointer rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {saving ? '保存中…' : `保存 ${entries.length} 条记录`}
            </button>
          </div>
        </div>
      )}
    >
      <form id="batch-record-form" onSubmit={handleSave}>
        <div className="-mx-1 mb-5 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <label className="relative flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <span className="sr-only">记录日期</span>
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(event) => {
                    setDate(event.target.value)
                    setError('')
                  }}
                  aria-invalid={Boolean(dateError)}
                  aria-describedby={dateError ? 'batch-record-date-error' : undefined}
                  required
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              {dateError && (
                <p id="batch-record-date-error" className="mt-1.5 text-xs font-medium text-red-600">
                  {dateError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fillLatestBalances}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                填入最近余额
              </button>
              <button
                type="button"
                onClick={clearAmounts}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                清空
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{prefillLatest
            ? '确认金额无误即可保存；如果余额已变化，直接覆盖输入框里的金额。'
            : '“填入最近余额”适合确认所有账户当天状态；也可以只填写本次发生变化的账户。'}</p>
        </div>

        {accounts.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">请先添加账户</p>
        ) : sections.map((section) => {
          const sectionAccounts = accounts.filter((account) => account.type === section.type)
          if (sectionAccounts.length === 0) return null

          return (
            <fieldset key={section.type} className="mb-5">
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                {section.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {sectionAccounts.length}
                </span>
              </legend>
              <div className="space-y-2">
                {sectionAccounts.map((account) => {
                  const fieldError = validationErrors.get(account.id)
                  const inputId = `batch-balance-${account.id}`
                  const errorId = `batch-balance-error-${account.id}`
                  return (
                    <label
                      key={account.id}
                      htmlFor={inputId}
                      className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-2xl border p-3 transition sm:grid-cols-[auto_minmax(0,1fr)_minmax(9rem,12rem)] ${
                        fieldError ? 'border-red-200 bg-red-50/40' : 'border-slate-100 bg-slate-50/50 focus-within:border-blue-200 focus-within:bg-white'
                      }`}
                    >
                      <span className={`row-span-2 flex h-9 w-9 items-center justify-center rounded-xl ${section.color}`}>
                        <AccountIcon name={account.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800" title={account.name}>
                          {account.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          最近 {account.latest_balance === null
                            ? '暂无记录'
                            : <Money value={account.latest_balance} className="font-medium text-slate-600" />}
                        </span>
                      </span>
                      <span className="relative col-span-2 sm:col-span-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                        <input
                          id={inputId}
                          type="number"
                          step="0.01"
                          min={account.type === 'pnl' ? undefined : 0}
                          value={amounts[account.id] ?? ''}
                          onChange={(event) => {
                            setAmounts((previous) => ({
                              ...previous,
                              [account.id]: event.target.value,
                            }))
                            setError('')
                          }}
                          aria-label={`${account.name} 的余额`}
                          aria-invalid={Boolean(fieldError)}
                          aria-describedby={fieldError ? errorId : undefined}
                          className={`w-full rounded-xl border bg-white py-2.5 pl-8 pr-3 text-right text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 ${
                            fieldError
                              ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                              : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
                          }`}
                          placeholder="留空则不更新"
                        />
                        {fieldError && (
                          <span id={errorId} className="mt-1 block text-right text-xs text-red-600">{fieldError}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        {error && (
          <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

function getLatestAmounts(accounts: AccountWithBalance[]): Record<string, string> {
  return Object.fromEntries(accounts.flatMap((account) => (
    account.latest_balance === null ? [] : [[account.id, String(account.latest_balance)]]
  )))
}
