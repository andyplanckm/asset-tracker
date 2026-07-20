import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { formatMoney } from '../lib/domain'
import { errorMessage, supabase } from '../lib/supabase'
import type { Balance } from '../lib/types'

interface Props {
  accountName: string
  balances: Balance[]
  onClose: () => void
  onChanged: () => Promise<void>
}

export default function BalanceHistory({ accountName, balances, onClose, onChanged }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const sortedBalances = [...balances].sort((left, right) => right.recorded_on.localeCompare(left.recorded_on))

  const handleDelete = async (balance: Balance) => {
    if (!confirm(`确定删除 ${balance.recorded_on} 的记录吗？`)) return
    setDeletingId(balance.id)
    setError('')
    try {
      const { error: deleteError } = await supabase.from('balances').delete().eq('id', balance.id)
      if (deleteError) throw deleteError
      await onChanged()
    } catch (deleteError: unknown) {
      setError(errorMessage(deleteError, '记录删除失败，请重试'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" role="presentation">
      <section className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col p-6" role="dialog" aria-modal="true" aria-labelledby="history-dialog-title">
        <div className="flex items-center justify-between mb-4">
          <h2 id="history-dialog-title" className="text-lg font-semibold text-gray-800">{accountName} - 历史记录</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {error && <p role="alert" className="mb-3 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex-1 overflow-y-auto">
          {sortedBalances.length === 0 ? <p className="text-center text-gray-400 py-8">暂无记录</p> : (
            <div className="space-y-2">
              {sortedBalances.map((balance) => (
                <div key={balance.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-800">¥{formatMoney(balance.amount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{balance.recorded_on}</p>
                  </div>
                  <button type="button" onClick={() => void handleDelete(balance)} disabled={deletingId === balance.id}
                    aria-label={`删除 ${balance.recorded_on} 的记录`} className="text-gray-400 hover:text-red-500 disabled:opacity-40 transition cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
