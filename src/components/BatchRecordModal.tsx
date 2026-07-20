import { useMemo, useState, type FormEvent } from 'react'
import { Calendar, X } from 'lucide-react'
import { isValidAmount, localDateString } from '../lib/domain'
import { AccountIcon } from '../lib/icons'
import { errorMessage, upsertBalances } from '../lib/supabase'
import type { AccountType, AccountWithBalance } from '../lib/types'

interface Props {
  userId: string
  accounts: AccountWithBalance[]
  onClose: () => void
  onSaved: () => Promise<void>
}

const sections: { type: AccountType; label: string; color: string }[] = [
  { type: 'asset', label: '资产账户', color: 'text-green-600 bg-green-50' },
  { type: 'investment', label: '投资账户', color: 'text-amber-500 bg-amber-50' },
  { type: 'liability', label: '负债账户', color: 'text-red-500 bg-red-50' },
  { type: 'pnl', label: '投资盈亏', color: 'text-violet-500 bg-violet-50' },
]

export default function BatchRecordModal({ userId, accounts, onClose, onSaved }: Props) {
  const [date, setDate] = useState(localDateString())
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const entries = useMemo(() => accounts.flatMap((account) => {
    const rawValue = amounts[account.id]
    if (rawValue === undefined || rawValue === '') return []
    const amount = Number(rawValue)
    return isValidAmount(account.type, amount) ? [{ accountId: account.id, amount }] : []
  }), [accounts, amounts])

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (entries.length === 0) return
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" role="presentation">
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="batch-dialog-title">
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 id="batch-dialog-title" className="text-lg font-semibold text-gray-800">批量记录</h2>
            <button type="button" onClick={onClose} aria-label="关闭" className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="text-xs text-gray-400">已填 {entries.length}/{accounts.length} 个账户</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {accounts.length === 0 ? <p className="text-center text-gray-400 py-8">请先添加账户</p> : sections.map((section) => {
            const sectionAccounts = accounts.filter((account) => account.type === section.type)
            if (sectionAccounts.length === 0) return null
            return (
              <fieldset key={section.type} className="mb-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase mb-2">{section.label}</legend>
                <div className="space-y-2">
                  {sectionAccounts.map((account) => (
                    <label key={account.id} className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg ${section.color} flex items-center justify-center shrink-0`}><AccountIcon name={account.icon} className="w-4 h-4" /></span>
                      <span className="text-sm text-gray-700 w-20 truncate" title={account.name}>{account.name}</span>
                      <span className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                        <input type="number" step="0.01" value={amounts[account.id] ?? ''}
                          onChange={(event) => setAmounts((previous) => ({ ...previous, [account.id]: event.target.value }))}
                          className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder={account.latest_balance === null ? '0.00' : String(account.latest_balance)} />
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </div>

        <div className="px-6 pb-6">
          {error && <p role="alert" className="mb-3 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving || entries.length === 0 || !date}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition cursor-pointer disabled:cursor-not-allowed">
            {saving ? '保存中...' : `批量保存（${entries.length}条记录）`}
          </button>
        </div>
      </form>
    </div>
  )
}
