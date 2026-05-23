import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import type { Balance } from '../lib/types'

interface Props {
  accountId: string
}

export default function TrendChart({ accountId }: Props) {
  const [data, setData] = useState<{ date: string; amount: number }[]>([])

  useEffect(() => {
    loadData()
  }, [accountId])

  const loadData = async () => {
    const { data: balances } = await supabase
      .from('balances')
      .select('*')
      .eq('account_id', accountId)
      .order('recorded_at', { ascending: true })
      .returns<Balance[]>()

    if (!balances || balances.length === 0) {
      setData([])
      return
    }

    const chartData = balances.map((b) => ({
      date: new Date(b.recorded_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      amount: b.amount,
    }))

    setData(chartData)
  }

  if (data.length < 2) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        至少需要2次记录才能显示趋势图
      </div>
    )
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#c4b5e0" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#c4b5e0"
            tickFormatter={(v) => `¥${v}`}
            width={50}
          />
          <Tooltip
            formatter={(value) => [`¥${Number(value).toLocaleString()}`, '余额']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
