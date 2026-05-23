import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Balance } from '../lib/types'

interface Props {
  accountId: string
  accountName: string
  onClose: () => void
}

export default function BalanceHistory({ accountId, accountName, onClose }: Props) {
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBalances()
  }, [accountId])

  const loadBalances = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('balances')
      .select('*')
      .eq('account_id', accountId)
      .order('recorded_at', { ascending: false })
      .returns<Balance[]>()

    setBalances(data || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('balances').delete().eq('id', id)
    loadBalances()
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{accountName} - 历史记录</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 py-8">加载中...</p>
          ) : balances.length === 0 ? (
            <p className="text-center text-gray-400 py-8">暂无记录</p>
          ) : (
            <div className="space-y-2">
              {balances.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-gray-800">¥{b.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(b.recorded_at)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="text-gray-400 hover:text-red-500 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
