import { useMemo, useState } from 'react'
import { Check, ChevronDown, Download, Info, Trash2, X } from 'lucide-react'
import { isValidAmount, localDateString, type DailySnapshot } from '../lib/domain'
import { errorMessage, supabase, upsertBalance } from '../lib/supabase'
import type { Account, AccountType } from '../lib/types'
import ConfirmDialog from './ui/ConfirmDialog'
import Money from './ui/Money'
import { useToast } from './ui/Toast'

interface Props {
  userId: string
  accounts: Account[]
  snapshots: DailySnapshot[]
  onChanged: () => Promise<void>
}

interface EditingCell {
  date: string
  accountId: string
  amount: string
}

interface PendingDelete {
  date: string
  ids: string[]
}

const PAGE_SIZE = 30

const groupDefinitions: { type: AccountType; label: string }[] = [
  { type: 'asset', label: '灵活取用' },
  { type: 'investment', label: '投资' },
  { type: 'liability', label: '负债' },
  { type: 'pnl', label: '投资盈亏' },
]

export default function HistoryTable({ userId, accounts, snapshots, onChanged }: Props) {
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const { showToast } = useToast()
  const rows = useMemo(() => [...snapshots].reverse(), [snapshots])
  const visibleRows = rows.slice(0, visibleCount)
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )
  const rawRecords = useMemo(
    () => snapshots
      .flatMap((snapshot) => [...snapshot.records.values()])
      .sort((left, right) => {
        const byDate = left.recorded_on.localeCompare(right.recorded_on)
        return byDate !== 0 ? byDate : left.recorded_at.localeCompare(right.recorded_at)
      }),
    [snapshots],
  )
  const accountGroups = useMemo(
    () => groupDefinitions
      .map((group) => ({
        ...group,
        accounts: accounts.filter((account) => account.type === group.type),
      }))
      .filter((group) => group.accounts.length > 0),
    [accounts],
  )

  const startEdit = (date: string, accountId: string, effectiveAmount: number | undefined) => {
    setEditing({
      date,
      accountId,
      amount: effectiveAmount === undefined ? '' : String(effectiveAmount),
    })
    setError('')
  }

  const handleEditSave = async () => {
    if (!editing) return
    const account = accountMap.get(editing.accountId)
    const amount = Number(editing.amount)
    if (!account) {
      setError('找不到该账户，请刷新页面后重试')
      return
    }
    if (editing.amount === '' || !isValidAmount(account.type, amount)) {
      setError(account.type === 'pnl' ? '请输入有效金额' : '该账户金额不能为负数')
      return
    }

    const snapshot = snapshots.find((item) => item.date === editing.date)
    const existingRecord = snapshot?.records.get(editing.accountId)
    setSaving(true)
    setError('')

    try {
      if (existingRecord) {
        const { error: updateError } = await supabase
          .from('balances')
          .update({ amount })
          .eq('id', existingRecord.id)
        if (updateError) throw updateError
      } else {
        await upsertBalance(userId, editing.accountId, amount, editing.date)
      }
      setEditing(null)
      await onChanged()
      showToast({
        variant: 'success',
        title: '余额已更新',
        message: `${account.name} · ${editing.date}`,
      })
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, '余额更新失败，请重试'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRow = async () => {
    if (!pendingDelete || pendingDelete.ids.length === 0) return
    const { error: deleteError } = await supabase
      .from('balances')
      .delete()
      .in('id', pendingDelete.ids)
    if (deleteError) throw deleteError

    const deletedDate = pendingDelete.date
    setPendingDelete(null)
    await onChanged()
    showToast({
      variant: 'success',
      title: '记录已删除',
      message: `${deletedDate} 的当日记录已移除`,
    })
  }

  const handleExportCsv = () => {
    const header = ['日期', '账户ID', '账户名', '类型', '金额', '估值时点', '首次创建时间']
    const dataRows = rawRecords.map((record) => {
      const account = accountMap.get(record.account_id)
      return [
        record.recorded_on,
        record.account_id,
        account?.name ?? '',
        account?.type ?? '',
        record.amount,
        record.recorded_at,
        record.created_at,
      ]
    })
    const csv = `\uFEFF${[header, ...dataRows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `asset-balance-records-${localDateString()}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)

    showToast({
      variant: 'success',
      title: 'CSV 已导出',
      message: `已导出 ${rawRecords.length} 条原始记录，文件包含完整金额。`,
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white/80 p-10 text-center">
        <HistoryEmptyIcon />
        <h3 className="font-semibold text-slate-900">还没有历史记录</h3>
        <p className="mt-1 text-sm text-slate-500">更新一次账户余额后，台账会自动出现在这里。</p>
      </div>
    )
  }

  const renderAmount = (
    row: DailySnapshot,
    account: Account,
    variant: 'desktop' | 'mobile',
  ) => {
    const effectiveAmount = row.values.get(account.id)
    const isRecordedToday = row.records.has(account.id)
    const isEditing = editing?.date === row.date && editing.accountId === account.id

    if (isEditing) {
      return (
        <div className={variant === 'desktop'
          ? 'flex items-center justify-end gap-1'
          : 'grid w-full grid-cols-[auto_minmax(0,1fr)_2.5rem_2.5rem] items-center gap-1'}>
          <span className="text-xs text-slate-400">¥</span>
          <input
            type="number"
            step="0.01"
            min={account.type === 'pnl' ? undefined : 0}
            value={editing.amount}
            onChange={(event) => setEditing({ ...editing, amount: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleEditSave()
              if (event.key === 'Escape') setEditing(null)
            }}
            aria-label={`${row.date} ${account.name} 的金额`}
            aria-invalid={Boolean(error)}
            className={`${variant === 'desktop' ? 'w-28' : 'min-w-0 w-full'} rounded-lg border border-blue-300 bg-white px-2 py-2 text-right text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => void handleEditSave()}
            disabled={saving}
            aria-label="保存"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setError('') }}
            aria-label="取消"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={() => startEdit(row.date, account.id, effectiveAmount)}
        title={isRecordedToday ? '点击编辑当日记录' : '当前沿用上次余额，点击添加当日记录'}
        className={`min-h-10 cursor-pointer rounded-lg px-2 text-right text-sm tabular-nums transition hover:bg-slate-100 ${
          effectiveAmount === undefined
            ? 'text-slate-400'
            : isRecordedToday
              ? typeColorClass(account.type)
              : 'text-slate-500'
        }`}
      >
        {effectiveAmount === undefined ? '—' : <Money value={effectiveAmount} />}
        {!isRecordedToday && effectiveAmount !== undefined && (
          <span className="ml-1 text-[11px] text-slate-400">沿用</span>
        )}
      </button>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h3 className="font-semibold text-slate-900">历史台账</h3>
            <p className="mt-1 text-xs text-slate-500">
              默认显示最近 {Math.min(visibleCount, rows.length)} / {rows.length} 个记录日
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              “沿用”表示该日未更新，使用此前余额
            </p>
            <button
              type="button"
              onClick={handleExportCsv}
              title="导出包含完整原始金额的 CSV 文件"
              aria-label="导出原始 CSV，文件包含完整金额"
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              导出原始 CSV
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">含完整金额</span>
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="m-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-3 p-3 md:hidden">
          {visibleRows.map((row) => {
            const recordIds = [...row.records.values()].map((record) => record.id)
            return (
              <details key={row.date} className="group rounded-2xl border border-slate-200 bg-white">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{formatDisplayDate(row.date)}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.records.size} 个账户在当日更新</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">净资产</p>
                      <Money value={row.netWorth} className="text-sm font-bold text-blue-700" />
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                  </div>
                </summary>
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="space-y-1">
                    {accountGroups.flatMap((group) => group.accounts
                      .filter((account) => row.values.has(account.id))
                      .map((account) => {
                        const isEditing = editing?.date === row.date && editing.accountId === account.id
                        return (
                          <div key={account.id} className={`flex min-h-11 gap-3 border-b border-slate-50 last:border-0 ${isEditing ? 'flex-col items-stretch py-2' : 'items-center justify-between py-1'}`}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-700">{account.name}</p>
                              <p className={`text-xs ${typeColorClass(account.type)}`}>{group.label}</p>
                            </div>
                            {renderAmount(row, account, 'mobile')}
                          </div>
                        )
                      }))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ date: row.date, ids: recordIds })}
                    disabled={recordIds.length === 0}
                    className="mt-3 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    删除当日实际记录
                  </button>
                </div>
              </details>
            )
          })}
        </div>

        <div className="hidden max-h-[42rem] overflow-auto md:block">
          <table className="w-full text-sm">
            <caption className="sr-only">
              按日期展示各账户余额、净资产以及当日是否实际记录。未实际记录的数据会沿用此前余额。
            </caption>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-100 bg-slate-50">
                <th scope="col" rowSpan={2} className="sticky left-0 z-30 whitespace-nowrap border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  日期
                </th>
                {accountGroups.map((group) => (
                  <th
                    key={group.type}
                    scope="colgroup"
                    colSpan={group.accounts.length}
                    className={`border-r border-slate-100 px-3 py-2 text-center text-xs font-semibold ${typeColorClass(group.type)} ${typeBgClass(group.type)}`}
                  >
                    {group.label} · {group.accounts.length}
                  </th>
                ))}
                <th scope="col" rowSpan={2} className="whitespace-nowrap bg-blue-50 px-4 py-3 text-right text-xs font-semibold text-blue-700">
                  净资产
                </th>
                <th scope="col" rowSpan={2} className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-slate-500">
                  操作
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-white">
                {accountGroups.flatMap((group) => group.accounts.map((account) => (
                  <th
                    key={account.id}
                    scope="col"
                    className={`min-w-32 whitespace-nowrap px-3 py-2 text-right text-xs font-medium ${typeColorClass(account.type)}`}
                  >
                    {account.name}
                  </th>
                )))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, rowIndex) => {
                const recordIds = [...row.records.values()].map((record) => record.id)
                return (
                  <tr key={row.date} className={`border-b border-slate-100 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30`}>
                    <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-inherit px-4 py-3 text-left font-semibold text-slate-700">
                      {formatDisplayDate(row.date)}
                    </th>
                    {accountGroups.flatMap((group) => group.accounts.map((account) => {
                      const isEditing = editing?.date === row.date && editing.accountId === account.id
                      return (
                        <td key={account.id} className={`px-2 py-2 text-right ${isEditing ? 'relative z-20 bg-white' : ''}`}>
                          {renderAmount(row, account, 'desktop')}
                        </td>
                      )
                    }))}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Money value={row.netWorth} className={`font-bold ${row.netWorth >= 0 ? 'text-blue-700' : 'text-rose-700'}`} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ date: row.date, ids: recordIds })}
                        disabled={recordIds.length === 0}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="删除该日实际记录"
                        aria-label={`删除 ${row.date} 的实际记录`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {visibleCount < rows.length && (
          <div className="border-t border-slate-100 p-4 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="min-h-10 cursor-pointer rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              再加载 {Math.min(PAGE_SIZE, rows.length - visibleCount)} 个记录日
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteRow}
        title={`删除 ${pendingDelete?.date ?? ''} 的记录？`}
        description="只会删除该日期实际填写的记录，后续历史可能继续沿用此前余额。"
        confirmLabel="确认删除"
        tone="danger"
      />
    </>
  )
}

function HistoryEmptyIcon() {
  return (
    <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Table2Icon />
    </span>
  )
}

function Table2Icon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </svg>
  )
}

function typeColorClass(type: AccountType): string {
  if (type === 'asset') return 'text-emerald-700'
  if (type === 'investment') return 'text-amber-700'
  if (type === 'liability') return 'text-rose-700'
  return 'text-violet-700'
}

function typeBgClass(type: AccountType): string {
  if (type === 'asset') return 'bg-emerald-50'
  if (type === 'investment') return 'bg-amber-50'
  if (type === 'liability') return 'bg-rose-50'
  return 'bg-violet-50'
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${year}/${month}/${day}`
}

function csvCell(value: string | number): string {
  const text = String(value)
  const safeText = typeof value === 'string' && /^[=+\-@\t]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText
}
