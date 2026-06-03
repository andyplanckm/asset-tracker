import { useState } from 'react'
import { X, Calendar } from 'lucide-react'
import { supabase, upsertBalance } from '../lib/supabase'
import type { Account } from '../lib/types'
import * as Icons from 'lucide-react'

interface Props {
  accounts: (Account & { latest_balance: number | null })[]
  onClose: () => void
  onSaved: () => void
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function BatchRecordModal({ accounts, onClose, onSaved }: Props) {
  const [date, setDate] = useState(todayStr())
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const assetAccounts = accounts.filter(a => a.type === 'asset')
  const investmentAccounts = accounts.filter(a => a.type === 'investment')
  const liabilityAccounts = accounts.filter(a => a.type === 'liability')
  const pnlAccounts = accounts.filter(a => a.type === 'pnl')

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)

    const entries = Object.entries(amounts).filter(([, val]) => {
      const num = parseFloat(val)
      return !isNaN(num)
    })

    for (const [accountId, val] of entries) {
      await upsertBalance(user.id, accountId, parseFloat(val), date)
    }

    setSaving(false)
    onSaved()
  }

  const updateAmount = (accountId: string, value: string) => {
    setAmounts(prev => ({ ...prev, [accountId]: value }))
  }

  const filledCount = Object.values(amounts).filter(v => v && !isNaN(parseFloat(v))).length

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName]
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null
  }

  const sectionColor = (type: string) => {
    if (type === 'asset') return 'text-green-600 bg-green-50'
    if (type === 'investment') return 'text-amber-500 bg-amber-50'
    if (type === 'liability') return 'text-red-500 bg-red-50'
    return 'text-violet-500 bg-violet-50'
  }

  const renderSection = (label: string, list: typeof accounts) => {
    if (list.length === 0) return null
    return (
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">{label}</h4>
        <div className="space-y-2">
          {list.map(acc => (
            <div key={acc.id} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg ${sectionColor(acc.type)} flex items-center justify-center shrink-0`}>
                {renderIcon(acc.icon)}
              </div>
              <span className="text-sm text-gray-700 w-20 truncate">{acc.name}</span>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                <input
                  type="number"
                  step="0.01"
                  value={amounts[acc.id] || ''}
                  onChange={(e) => updateAmount(acc.id, e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder={acc.latest_balance !== null ? `${acc.latest_balance}` : '0.00'}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">批量记录</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-400">
              已填 {filledCount}/{accounts.length} 个账户
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {accounts.length === 0 ? (
            <p className="text-center text-gray-400 py-8">请先添加账户</p>
          ) : (
            <>
              {renderSection('资产账户', assetAccounts)}
              {renderSection('投资账户', investmentAccounts)}
              {renderSection('负债账户', liabilityAccounts)}
              {renderSection('投资盈亏', pnlAccounts)}
            </>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={saving || filledCount === 0}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition cursor-pointer"
          >
            {saving ? '保存中...' : `批量保存（${filledCount}条记录）`}
          </button>
        </div>
      </div>
    </div>
  )
}
