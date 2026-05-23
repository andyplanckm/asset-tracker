import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Account } from '../lib/types'

interface Props {
  account: Account
  onClose: () => void
  onSaved: () => void
}

export default function RecordBalanceModal({ account, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const num = parseFloat(amount)
    if (isNaN(num) || num < 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('balances').insert({
      user_id: user.id,
      account_id: account.id,
      amount: num,
      recorded_at: new Date().toISOString(),
    })

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">记录余额</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          账户：<span className="text-gray-700 font-medium">{account.name}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              余额（元）
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">¥</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !amount || parseFloat(amount) < 0}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition cursor-pointer"
          >
            {saving ? '保存中...' : '保存记录'}
          </button>
        </div>
      </div>
    </div>
  )
}
