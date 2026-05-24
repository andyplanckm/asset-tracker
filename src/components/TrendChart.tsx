import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts'
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

    // 按天分组，每天只保留最后一条记录
    const dayMap = new Map<string, number>()
    balances.forEach((b) => {
      const d = new Date(b.recorded_at)
      const key = `${d.getFullYear()}/${d.getMonth()}/${d.getDate()}`
      dayMap.set(key, b.amount)
    })

    const chartData = Array.from(dayMap.entries())
      .map(([key, amount]) => {
        const [y, m, d] = key.split('/').map(Number)
        const noonTs = new Date(y, m, d, 12, 0, 0).getTime()
        return {
          date: new Date(noonTs).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          amount,
          _ts: noonTs,
        }
      })
      .sort((a, b) => a._ts - b._ts)

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
    <div className="h-52">
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
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
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
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          />
          <Area type="monotone" dataKey="amount" fill="url(#chartGradient)" stroke="none" />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
