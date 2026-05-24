import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'
import * as Icons from 'lucide-react'

interface AccountAmount {
  account: Account
  amount: number | null
  balanceId: string | null
}

interface Row {
  date: string
  _ts: number
  items: AccountAmount[]
}

interface Props {
  onRecorded: () => void
}

export default function HistoryTable({ onRecorded }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<{ date: string; accountId: string; currentAmount: number | null } | null>(null)
  const [editAmount, setEditAmount] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Account[]>()

    setAccounts(accountsData || [])

    if (!accountsData || accountsData.length === 0) {
      setLoading(false)
      return
    }

    const accountIds = accountsData.map(a => a.id)
    const { data: balances } = await supabase
      .from('balances')
      .select('*')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true })
      .returns<Balance[]>()

    if (!balances || balances.length === 0) {
      setLoading(false)
      return
    }

    // Build cumulative state: for each day, what's each account's latest balance?
    const dayMap = new Map<string, Map<string, { amount: number; balanceId: string }>>()
    const currentState = new Map<string, { amount: number; balanceId: string }>()

    balances.forEach(b => {
      const ts = new Date(b.recorded_at)
      const dayKey = ts.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
      currentState.set(b.account_id, { amount: b.amount, balanceId: b.id })
      dayMap.set(dayKey, new Map(currentState))
    })

    const dateKeys = Array.from(dayMap.keys()).sort().reverse()

    const tableRows: Row[] = dateKeys.map(dk => {
      const dayBalances = dayMap.get(dk)!
      const items: AccountAmount[] = accountsData.map(acc => {
        const entry = dayBalances.get(acc.id)
        return {
          account: acc,
          amount: entry ? entry.amount : null,
          balanceId: entry ? entry.balanceId : null,
        }
      })
      // Parse the date to get a timestamp for sorting
      const parts = dk.split('/')
      const _ts = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime()
      return { date: dk, _ts, items }
    })

    setRows(tableRows)
    setLoading(false)
  }

  const handleDeleteRow = async (row: Row) => {
    if (!confirm(`确定要删除 ${row.date} 的所有记录吗？`)) return
    const balanceIds = row.items
      .filter(item => item.balanceId)
      .map(item => item.balanceId!)
    if (balanceIds.length > 0) {
      // Delete each balance record for this date
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      for (const bid of balanceIds) {
        await supabase.from('balances').delete().eq('id', bid)
      }
    }
    loadData()
    onRecorded()
  }

  const startEdit = (row: Row, item: AccountAmount) => {
    setEditingCell({ date: row.date, accountId: item.account.id, currentAmount: item.amount })
    setEditAmount(item.amount !== null ? String(item.amount) : '')
  }

  const handleEditSave = async () => {
    if (!editingCell) return
    const num = parseFloat(editAmount)
    if (isNaN(num) || num < 0) return

    // Find the existing balance record for this account on this date
    const row = rows.find(r => r.date === editingCell.date)
    if (!row) return
    const item = row.items.find(i => i.account.id === editingCell.accountId)
    if (!item) return

    if (item.balanceId) {
      // Update existing record
      await supabase.from('balances').update({ amount: num }).eq('id', item.balanceId)
    } else {
      // Insert new record for this date
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const parts = editingCell.date.split('/')
      const recordedAt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0)
      await supabase.from('balances').insert({
        user_id: user.id,
        account_id: editingCell.accountId,
        amount: num,
        recorded_at: recordedAt.toISOString(),
      })
    }

    setEditingCell(null)
    loadData()
    onRecorded()
  }

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName]
    return IconComponent ? <IconComponent className="w-3.5 h-3.5" /> : null
  }

  const typeColor = (type: string) => {
    if (type === 'asset') return 'text-green-600'
    if (type === 'investment') return 'text-amber-500'
    return 'text-red-500'
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-gray-400">暂无记录</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50/50 z-10">
                日期
              </th>
              {accounts.map(acc => (
                <th key={acc.id} className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap min-w-[100px]">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={typeColor(acc.type)}>{renderIcon(acc.icon)}</span>
                    <span className={`text-xs ${typeColor(acc.type)}`}>{acc.name}</span>
                  </div>
                </th>
              ))}
              <th className="text-center px-3 py-3 font-medium text-gray-500 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.date} className={`border-b border-gray-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                <td className="px-4 py-3 text-gray-600 font-medium whitespace-nowrap sticky left-0 bg-inherit">
                  {row.date}
                </td>
                {row.items.map((item) => (
                  <td key={item.account.id} className="px-3 py-3 text-right">
                    {editingCell && editingCell.date === row.date && editingCell.accountId === item.account.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-gray-400 text-xs">¥</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-24 px-2 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave()
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                        <button onClick={handleEditSave} className="text-green-500 hover:text-green-600 text-xs cursor-pointer">✓</button>
                        <button onClick={() => setEditingCell(null)} className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer">✕</button>
                      </div>
                    ) : (
                      <span
                        className={`cursor-pointer hover:underline ${item.amount !== null ? typeColor(item.account.type) : 'text-gray-300'}`}
                        onClick={() => startEdit(row, item)}
                        title="点击编辑"
                      >
                        {item.amount !== null ? `¥${item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDeleteRow(row)}
                      className="text-gray-400 hover:text-red-500 transition cursor-pointer"
                      title="删除该日记录"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline edit modal backdrop */}
      {editingCell && (
        <div className="fixed inset-0 z-40" onClick={() => setEditingCell(null)} />
      )}
    </div>
  )
}
