import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Calendar, Copy, Eraser, Info } from 'lucide-react'
import { isValidAmount, localDateString } from '../lib/domain'
import { fillMissingBalanceAmounts, previewBatchBalances } from '../lib/batchBalances'
import { AccountIcon } from '../lib/icons'
import { errorMessage, upsertBalances } from '../lib/supabase'
import type { AccountType, AccountWithBalance, Balance } from '../lib/types'
import Dialog from './ui/Dialog'
import Money from './ui/Money'

interface Props {
  userId: string
  accounts: AccountWithBalance[]
  balancesByAccount: ReadonlyMap<string, Balance[]>
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
  { type: 'liability', label: '负债账户', color: 'bg-rose-50 text-rose-700' },
  { type: 'investment', label: '投资资产', color: 'bg-amber-50 text-amber-700' },
  { type: 'pnl', label: '投资盈亏', color: 'bg-violet-50 text-violet-700' },
]

export default function BatchRecordModal({
  userId,
  accounts,
  balancesByAccount,
  prefillLatest = false,
  onClose,
  onSaved,
}: Props) {
  const today = localDateString()
  const [date, setDate] = useState(today)
  const [amounts, setAmounts] = useState<Record<string, string>>(() => (
    prefillLatest ? fillMissingBalanceAmounts(accounts, balancesByAccount, today) : {}
  ))
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false)
  const [notice, setNotice] = useState('')
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

  const preview = useMemo(() => previewBatchBalances(
    accounts, balancesByAccount, date, entries,
  ), [accounts, balancesByAccount, date, entries])
  const controlsDisabled = saving || pendingDate !== null
  const closeModal = () => {
    if (!savingRef.current) onClose()
  }

  const changeDate = (nextDate: string) => {
    if (savingRef.current || pendingDate !== null || nextDate === date) return
    if (Object.values(amounts).some((amount) => amount.trim() !== '')) {
      setPendingDate(nextDate)
      return
    }
    setDate(nextDate)
    setOverwriteConfirmed(false)
    setNotice('')
    setError('')
  }

  const confirmDateChange = () => {
    if (savingRef.current || pendingDate === null) return
    setDate(pendingDate)
    setAmounts({})
    setPendingDate(null)
    setOverwriteConfirmed(false)
    setNotice('日期已切换，请重新填写或填入该日及之前的余额。')
    setError('')
  }

  const fillLatestBalances = () => {
    if (savingRef.current || pendingDate !== null || dateError) return
    setAmounts((previous) => fillMissingBalanceAmounts(accounts, balancesByAccount, date, previous))
    setOverwriteConfirmed(false)
    setNotice('已为留空账户带入所选日期及之前的最近余额，已填写的金额保持不变。')
    setError('')
  }

  const clearAmounts = () => {
    if (savingRef.current || pendingDate !== null) return
    setAmounts({})
    setOverwriteConfirmed(false)
    setNotice('已清空本次填写，已有记录保持不变。')
    setError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (savingRef.current || pendingDate !== null) return
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
    if (preview.overwriteCount > 0 && !overwriteConfirmed) {
      setError('请先确认覆盖所选日期已有的记录。')
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')

    try {
      await upsertBalances(userId, entries, date)
      await onSaved()
    } catch (saveError: unknown) {
      savingRef.current = false
      setError(errorMessage(saveError, '批量保存失败，请重试'))
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={closeModal}
      title={prefillLatest ? '确认待更新账户' : '集中更新余额'}
      description={prefillLatest
        ? '已带入今天及之前的最近余额，请确认后保存。'
        : '选择日期，核对变化后一次保存。留空账户保持不变。'}
      size="xl"
      showCloseButton={!saving}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      contentClassName="py-4"
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            将更新 <span className="font-semibold text-slate-800">{entries.length}</span> / {accounts.length} 个账户
            {preview.overwriteCount > 0 && <span className="ml-2 text-amber-700">覆盖 {preview.overwriteCount} 条</span>}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              form="batch-record-form"
              disabled={controlsDisabled || entries.length === 0 || validationErrors.size > 0 || Boolean(dateError) || (preview.overwriteCount > 0 && !overwriteConfirmed)}
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
                  disabled={controlsDisabled}
                  onChange={(event) => changeDate(event.target.value)}
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
                disabled={controlsDisabled || Boolean(dateError)}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                填入空白项
              </button>
              <button
                type="button"
                onClick={clearAmounts}
                disabled={controlsDisabled}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                清空
              </button>
            </div>
          </div>
          {!dateError && (
            <p className="mt-3 text-xs text-slate-500">
              {date} 已有 {preview.existingOnDateCount} 个账户记录；本次将新增 {entries.length - preview.overwriteCount} 条、覆盖 {preview.overwriteCount} 条。
            </p>
          )}
        </div>

        {pendingDate !== null && (
          <div role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">切换日期前，请确认本次输入</p>
            <p className="mt-1 leading-6">切换到 {pendingDate || '未选择日期'} 将清空尚未保存的金额，避免将同一批余额误记到另一天。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPendingDate(null)} className="min-h-10 rounded-xl border border-amber-200 bg-white px-3 font-semibold">保留当前日期和金额</button>
              <button type="button" onClick={confirmDateChange} className="min-h-10 rounded-xl bg-amber-800 px-3 font-semibold text-white">切换并清空输入</button>
            </div>
          </div>
        )}

        {notice && <p role="status" className="mb-4 text-xs leading-5 text-slate-600">{notice}</p>}

        <div className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>“填入空白项”只使用所选日期及之前的最近记录，不会覆盖已输入金额。金额为账户余额，负债填正数，投资盈亏可填负数。</p>
        </div>

        {entries.length > 0 && !dateError && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">本次账户在 {date} 的净资产预览</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Money value={preview.netWorthAfter} className="text-xl font-bold text-slate-900" />
              <Money value={preview.netWorthChange} signed className="text-sm font-semibold text-slate-600" />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">仅计算本窗口账户；留空账户沿用该日前值。负债从资产中扣除，投资盈亏不重复计入。</p>
            {preview.newInSnapshotCount > 0 && <p className="mt-1 text-xs leading-5 text-amber-800">包含 {preview.newInSnapshotCount} 个首次纳入该日快照的账户，其金额变化不代表投资收益。</p>}
            {date < today && <p className="mt-1 text-xs leading-5 text-slate-500">补录历史余额可能影响该日之后、下次记录之前的历史趋势。</p>}
          </div>
        )}

        {preview.overwriteCount > 0 && (
          <label className="mb-5 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <input type="checkbox" checked={overwriteConfirmed} disabled={controlsDisabled} onChange={(event) => setOverwriteConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber-800" />
            <span>我已核对：保存会替换 {date} 已有的 {preview.overwriteCount} 条余额记录。</span>
          </label>
        )}

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
                  const previousBalance = preview.records.get(account.id)
                  const rawAmount = amounts[account.id]
                  const hasAmount = rawAmount !== undefined && rawAmount !== '' && !fieldError
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
                          {previousBalance
                            ? <>{previousBalance.recorded_on === date ? '当日已有 ' : `${previousBalance.recorded_on} `}<Money value={previousBalance.amount} className="font-medium text-slate-600" /></>
                            : '该日及之前暂无记录'}
                        </span>
                        {hasAmount && <span className="mt-1 block text-xs text-slate-500">{previousBalance ? <>余额差额 <Money value={Number(rawAmount) - previousBalance.amount} signed /></> : '首次记录'}</span>}
                      </span>
                      <span className="relative col-span-2 sm:col-span-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                        <input
                          id={inputId}
                          type="number"
                          step="0.01"
                          min={account.type === 'pnl' ? undefined : 0}
                          disabled={controlsDisabled}
                          value={amounts[account.id] ?? ''}
                          onChange={(event) => {
                            if (savingRef.current || pendingDate !== null) return
                            setAmounts((previous) => ({
                              ...previous,
                              [account.id]: event.target.value,
                            }))
                            setOverwriteConfirmed(false)
                            setNotice('')
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
