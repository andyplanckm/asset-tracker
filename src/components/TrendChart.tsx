import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import type { Balance } from '../lib/types'

interface Props {
  accountId: string
}

type ScaleMode = 'adaptive' | 'zero'

export default function TrendChart({ accountId }: Props) {
  const [data, setData] = useState<{ date: string; amount: number; _ts: number }[]>([])
  const [scaleMode, setScaleMode] = useState<ScaleMode>('adaptive')

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
      _ts: new Date(b.recorded_at).getTime(),
    }))

    setData(chartData)
  }

  const amounts = data.map(d => d.amount)
  const dataMin = Math.min(...amounts)
  const dataMax = Math.max(...amounts)
  const range = dataMax - dataMin || 1
  const padding = range * 0.15

  const yDomain: [number, number] = scaleMode === 'adaptive'
    ? [dataMin - padding, dataMax + padding]
    : [0, dataMax + padding]

  if (data.length < 2) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        至少需要2次记录才能显示趋势图
      </div>
    )
  }

  return (
    <div className="h-48">
      <div className="flex items-center justify-end mb-1">
        <div className="flex rounded-md overflow-hidden border border-gray-200 text-[10px]">
          <button
            onClick={() => setScaleMode('adaptive')}
            className={`px-2 py-0.5 cursor-pointer transition ${scaleMode === 'adaptive' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            自适应
          </button>
          <button
            onClick={() => setScaleMode('zero')}
            className={`px-2 py-0.5 cursor-pointer transition ${scaleMode === 'zero' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            从零开始
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="_ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 11 }}
            stroke="#c4b5e0"
            tickFormatter={(ts: number) => {
              const d = new Date(ts)
              return `${d.getMonth() + 1}/${d.getDate()}`
            }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 11 }}
            stroke="#c4b5e0"
            tickFormatter={(v) => `¥${v}`}
            width={50}
          />
          <Tooltip
            formatter={(value) => [`¥${Number(value).toLocaleString()}`, '余额']}
            labelFormatter={(label) => new Date(Number(label)).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
