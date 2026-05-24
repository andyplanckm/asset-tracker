import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase, upsertBalance } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'

interface Row {
  date: string
  dayTotal: string
  cells: { accountId: string; amount: number | null; balanceId: string | null }[]
}

interface Props {
  onRecorded: () => void
}

export default function HistoryTable({ onRecorded }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ date: string; accountId: string; amount: string } | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: accountsData } = await supabase
      .from('accounts').select('*').eq('user_id', user.id)
      .order('type').order('created_at').returns<Account[]>()

    setAccounts(accountsData || [])

    if (!accountsData || accountsData.length === 0) { setLoading(false); return }

    const accountIds = accountsData.map(a => a.id)
    const { data: balances } = await supabase
      .from('balances').select('*').in('account_id', accountIds)
      .order('recorded_at', { ascending: true }).returns<Balance[]>()

    if (!balances || balances.length === 0) { setRows([]); setLoading(false); return }

    // Group by date string (YYYY/MM/DD), keep LATEST balance per account per day
    const dateStateMap = new Map<string, Map<string, { amount: number; balanceId: string }>>()
    balances.forEach(b => {
      const d = new Date(b.recorded_at)
      const dayKey = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
      if (!dateStateMap.has(dayKey)) dateStateMap.set(dayKey, new Map())
      // Since balances are ordered ascending, later records overwrite earlier for the same account on the same day
      dateStateMap.get(dayKey)!.set(b.account_id, { amount: b.amount, balanceId: b.id })
    })

    const dateKeys = Array.from(dateStateMap.keys()).sort().reverse()

    const tableRows: Row[] = dateKeys.map(dk => {
      const dayBalances = dateStateMap.get(dk)!
      let rowSum = 0
      const cells = accountsData.map(acc => {
        const entry = dayBalances.get(acc.id)
        const amount = entry ? entry.amount : null
        if (amount !== null) {
          if (acc.type === 'asset' || acc.type === 'investment') rowSum += amount
          else rowSum -= amount
        }
        return {
          accountId: acc.id,
          amount,
          balanceId: entry ? entry.balanceId : null,
        }
      })
      return { date: dk, dayTotal: formatMoney(rowSum), cells }
    })

    setRows(tableRows)
    setLoading(false)
  }

  const handleDeleteRow = async (row: Row) => {
    if (!confirm(`确定要删除 ${row.date} 的所有记录吗？`)) return
    const ids = row.cells.filter(c => c.balanceId).map(c => c.balanceId!)
    for (const id of ids) {
      await supabase.from('balances').delete().eq('id', id)
    }
    loadData()
    onRecorded()
  }

  const startEdit = (date: string, accountId: string, amount: number | null) => {
    setEditing({ date, accountId, amount: amount !== null ? String(amount) : '' })
  }

  const handleEditSave = async () => {
    if (!editing) return
    const num = parseFloat(editing.amount)
    if (isNaN(num) || num < 0) return

    const row = rows.find(r => r.date === editing.date)
    if (!row) return
    const cell = row.cells.find(c => c.accountId === editing.accountId)
    if (!cell) return

    if (cell.balanceId) {
      await supabase.from('balances').update({ amount: num }).eq('id', cell.balanceId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const dateStr = editing.date.replace(/\//g, '-')
      await upsertBalance(user.id, editing.accountId, num, dateStr)
    }

    setEditing(null)
    loadData()
    onRecorded()
  }

  const typeColorClass = (type: string) => {
    if (type === 'asset') return 'text-green-600'
    if (type === 'investment') return 'text-amber-500'
    return 'text-red-500'
  }
  const typeBgClass = (type: string) => {
    if (type === 'asset') return 'bg-green-50'
    if (type === 'investment') return 'bg-amber-50'
    return 'bg-red-50'
  }

  if (loading) return <div className="text-center text-gray-400 py-8">加载中...</div>
  if (rows.length === 0) return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
      <p className="text-gray-400">暂无记录</p>
    </div>
  )

  // Group accounts by type for column headers
  const accountGroups = [
    { type: 'asset' as const, label: '资产', accounts: accounts.filter(a => a.type === 'asset') },
    { type: 'investment' as const, label: '投资', accounts: accounts.filter(a => a.type === 'investment') },
    { type: 'liability' as const, label: '负债', accounts: accounts.filter(a => a.type === 'liability') },
  ].filter(g => g.accounts.length > 0)

  const hasAnyAccount = accounts.length > 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Group header row */}
            {hasAnyAccount && (
              <tr className="border-b border-gray-100 bg-gray-50/30">
                <th className="sticky left-0 bg-gray-50/30 z-10 px-3 py-2 text-left text-xs text-gray-400 font-medium whitespace-nowrap border-r border-gray-100">
                  日期
                </th>
                {accountGroups.map(g => (
                  <th
                    key={g.type}
                    colSpan={g.accounts.length}
                    className={`px-2 py-2 text-center text-xs font-semibold border-r border-gray-100 ${typeColorClass(g.type)} ${typeBgClass(g.type)}`}
                  >
                    总{g.label}（{g.accounts.length}个账户）
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-semibold text-blue-500 bg-blue-50 whitespace-nowrap">
                  净资产
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 whitespace-nowrap">
                  操作
                </th>
              </tr>
            )}
            {/* Account name row */}
            {hasAnyAccount && (
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 bg-white z-10 px-3 py-2 text-left border-r border-gray-100"></th>
                {accountGroups.map(g =>
                  g.accounts.map(acc => (
                    <th key={acc.id} className={`px-2 py-2 text-right text-[11px] font-medium whitespace-nowrap min-w-[90px] ${typeColorClass(acc.type)}`}>
                      {acc.name}
                    </th>
                  ))
                )}
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2"></th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const cellMap = new Map(row.cells.map(c => [c.accountId, c]))
              return (
                <tr key={row.date} className={`border-b border-gray-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="sticky left-0 bg-inherit z-10 px-3 py-2.5 text-gray-600 font-medium whitespace-nowrap border-r border-gray-100">
                    {row.date}
                  </td>
                  {accountGroups.map(g =>
                    g.accounts.map(acc => {
                      const cell = cellMap.get(acc.id)
                      const isEditing = editing && editing.date === row.date && editing.accountId === acc.id
                      return (
                        <td key={acc.id} className="px-2 py-2.5 text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-gray-400 text-[11px]">¥</span>
                              <input
                                type="number" step="0.01"
                                value={editing!.amount}
                                onChange={e => setEditing({ ...editing!, amount: e.target.value })}
                                className="w-20 px-1.5 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditing(null) }}
                              />
                              <button onClick={handleEditSave} className="text-green-500 hover:text-green-600 text-xs cursor-pointer">✓</button>
                              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer">✕</button>
                            </div>
                          ) : (
                            <span
                              className={`cursor-pointer hover:underline ${cell?.amount !== null ? typeColorClass(acc.type) : 'text-gray-300'}`}
                              onClick={() => startEdit(row.date, acc.id, cell?.amount ?? null)}
                              title="点击编辑"
                            >
                              {cell && cell.amount !== null ? `¥${cell.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                            </span>
                          )}
                        </td>
                      )
                    })
                  )}
                  <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${parseFloat(row.dayTotal) >= 0 ? 'text-blue-500' : 'text-red-400'}`}>
                    ¥{row.dayTotal}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => handleDeleteRow(row)} className="text-gray-400 hover:text-red-500 transition cursor-pointer" title="删除该日所有记录">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing && <div className="fixed inset-0 z-40" onClick={() => setEditing(null)} />}
    </div>
  )
}

function formatMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
