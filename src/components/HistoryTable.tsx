import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { buildDailySnapshots, formatMoney, isValidAmount } from '../lib/domain'
import { errorMessage, supabase, upsertBalance } from '../lib/supabase'
import type { Account, AccountType, Balance } from '../lib/types'

interface Props {
  userId: string
  accounts: Account[]
  balances: Balance[]
  onChanged: () => Promise<void>
}

interface EditingCell {
  date: string
  accountId: string
  amount: string
}

const groupDefinitions: { type: AccountType; label: string }[] = [
  { type: 'asset', label: '灵活取用' },
  { type: 'investment', label: '投资' },
  { type: 'liability', label: '负债' },
  { type: 'pnl', label: '投资盈亏' },
]

export default function HistoryTable({ userId, accounts, balances, onChanged }: Props) {
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const snapshots = useMemo(() => buildDailySnapshots(accounts, balances), [accounts, balances])
  const rows = [...snapshots].reverse()
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const accountGroups = groupDefinitions
    .map((group) => ({ ...group, accounts: accounts.filter((account) => account.type === group.type) }))
    .filter((group) => group.accounts.length > 0)

  const handleDeleteRow = async (date: string, ids: string[]) => {
    if (ids.length === 0 || !confirm(`确定要删除 ${date} 的所有当日记录吗？`)) return
    setSaving(true)
    setError('')
    try {
      const { error: deleteError } = await supabase.from('balances').delete().in('id', ids)
      if (deleteError) throw deleteError
      await onChanged()
    } catch (deleteError: unknown) {
      setError(errorMessage(deleteError, '当日记录删除失败，请重试'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (date: string, accountId: string, effectiveAmount: number | undefined) => {
    setEditing({ date, accountId, amount: effectiveAmount === undefined ? '' : String(effectiveAmount) })
    setError('')
  }

  const handleEditSave = async () => {
    if (!editing) return
    const account = accountMap.get(editing.accountId)
    const amount = Number(editing.amount)
    if (!account || editing.amount === '' || !isValidAmount(account.type, amount)) return

    const snapshot = snapshots.find((item) => item.date === editing.date)
    const existingRecord = snapshot?.records.get(editing.accountId)
    setSaving(true)
    setError('')

    try {
      if (existingRecord) {
        const { error: updateError } = await supabase.from('balances').update({ amount }).eq('id', existingRecord.id)
        if (updateError) throw updateError
      } else {
        await upsertBalance(userId, editing.accountId, amount, editing.date)
      }
      setEditing(null)
      await onChanged()
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, '余额更新失败，请重试'))
    } finally {
      setSaving(false)
    }
  }

  if (rows.length === 0) {
    return <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center"><p className="text-gray-400">暂无记录</p></div>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {error && <p role="alert" className="m-3 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left text-xs text-gray-400 font-medium whitespace-nowrap border-r border-gray-100">日期</th>
              {accountGroups.map((group) => (
                <th key={group.type} colSpan={group.accounts.length}
                  className={`px-2 py-2 text-center text-xs font-semibold border-r border-gray-100 ${typeColorClass(group.type)} ${typeBgClass(group.type)}`}>
                  {group.type === 'asset' ? group.label : `总${group.label}`}（{group.accounts.length}个账户）
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-semibold text-blue-500 bg-blue-50 whitespace-nowrap">净资产</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 whitespace-nowrap">操作</th>
            </tr>
            <tr className="border-b border-gray-100">
              <th className="sticky left-0 bg-white z-10 px-3 py-2 text-left border-r border-gray-100" />
              {accountGroups.flatMap((group) => group.accounts.map((account) => (
                <th key={account.id} className={`px-2 py-2 text-right text-[11px] font-medium whitespace-nowrap min-w-[100px] ${typeColorClass(account.type)}`}>{account.name}</th>
              )))}
              <th className="px-3 py-2" />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const recordIds = [...row.records.values()].map((record) => record.id)
              return (
                <tr key={row.date} className={`border-b border-gray-50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="sticky left-0 bg-inherit z-10 px-3 py-2.5 text-gray-600 font-medium whitespace-nowrap border-r border-gray-100">{row.date}</td>
                  {accountGroups.flatMap((group) => group.accounts.map((account) => {
                    const effectiveAmount = row.values.get(account.id)
                    const isRecordedToday = row.records.has(account.id)
                    const isEditing = editing?.date === row.date && editing.accountId === account.id
                    return (
                      <td key={account.id} className={`px-2 py-2.5 text-right ${isEditing ? 'relative z-20 bg-white' : ''}`}>
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-gray-400 text-[11px]">¥</span>
                            <input type="number" step="0.01" value={editing.amount}
                              onChange={(event) => setEditing({ ...editing, amount: event.target.value })}
                              onKeyDown={(event) => { if (event.key === 'Enter') void handleEditSave(); if (event.key === 'Escape') setEditing(null) }}
                              className="w-24 px-1.5 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" autoFocus />
                            <button type="button" onClick={() => void handleEditSave()} disabled={saving} aria-label="保存" className="text-green-500 hover:text-green-600 disabled:opacity-40 cursor-pointer">✓</button>
                            <button type="button" onClick={() => setEditing(null)} aria-label="取消" className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => startEdit(row.date, account.id, effectiveAmount)} title={isRecordedToday ? '点击编辑当日记录' : '沿用上次余额，点击添加当日记录'}
                            className={`cursor-pointer hover:underline ${effectiveAmount === undefined ? 'text-gray-300' : isRecordedToday ? typeColorClass(account.type) : 'text-gray-400'}`}>
                            {effectiveAmount === undefined ? '—' : `¥${formatMoney(effectiveAmount)}`}
                            {!isRecordedToday && effectiveAmount !== undefined && <span className="ml-1 text-[9px] text-gray-300">沿用</span>}
                          </button>
                        )}
                      </td>
                    )
                  }))}
                  <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${row.netWorth >= 0 ? 'text-blue-500' : 'text-red-400'}`}>¥{formatMoney(row.netWorth)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button type="button" onClick={() => void handleDeleteRow(row.date, recordIds)} disabled={saving}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-40 transition cursor-pointer" title="删除该日实际记录" aria-label={`删除 ${row.date} 的记录`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function typeColorClass(type: AccountType): string {
  if (type === 'asset') return 'text-green-600'
  if (type === 'investment') return 'text-amber-500'
  if (type === 'liability') return 'text-red-500'
  return 'text-violet-500'
}

function typeBgClass(type: AccountType): string {
  if (type === 'asset') return 'bg-green-50'
  if (type === 'investment') return 'bg-amber-50'
  if (type === 'liability') return 'bg-red-50'
  return 'bg-violet-50'
}
