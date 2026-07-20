import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { isValidAmount, localDateString } from '../lib/domain'
import { errorMessage, upsertBalance } from '../lib/supabase'
import type { Account } from '../lib/types'

interface Props {
  userId: string
  account: Account
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function RecordBalanceModal({ userId, account, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localDateString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const parsedAmount = Number(amount)
  const amountIsValid = amount !== '' && isValidAmount(account.type, parsedAmount)

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!amountIsValid) return
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" role="presentation">
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="record-dialog-title" className="text-lg font-semibold text-gray-800">记录余额</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-gray-500 mb-4">账户：<span className="text-gray-700 font-medium">{account.name}</span></p>
        <div className="space-y-4">
          <div>
            <label htmlFor="balance-amount" className="block text-sm font-medium text-gray-600 mb-1">
              {account.type === 'pnl' ? '盈亏（元，可为负数）' : '余额（元）'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">¥</span>
              <input id="balance-amount" type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="0.00" autoFocus />
            </div>
          </div>
          <div>
            <label htmlFor="balance-date" className="block text-sm font-medium text-gray-600 mb-1">记录日期</label>
            <input id="balance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {error && <p role="alert" className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving || !amountIsValid || !date}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition cursor-pointer disabled:cursor-not-allowed">
            {saving ? '保存中...' : '保存记录'}
          </button>
        </div>
      </form>
    </div>
  )
}
