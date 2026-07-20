import { useId, useMemo, useState } from 'react'
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactMoney, formatMoney, localNoonTimestamp } from '../lib/domain'
import type { Balance } from '../lib/types'

interface Props {
  balances: Balance[]
}

type ScaleMode = 'adaptive' | 'zero'

export default function TrendChart({ balances }: Props) {
  const [scaleMode, setScaleMode] = useState<ScaleMode>('adaptive')
  const gradientId = `account-gradient-${useId().replace(/:/g, '')}`
  const data = useMemo(() => {
    const latestByDay = new Map<string, Balance>()
    for (const balance of [...balances].sort((left, right) => left.recorded_at.localeCompare(right.recorded_at))) {
      latestByDay.set(balance.recorded_on, balance)
    }
    return [...latestByDay.values()]
      .sort((left, right) => left.recorded_on.localeCompare(right.recorded_on))
      .map((balance) => ({
        _ts: localNoonTimestamp(balance.recorded_on),
        amount: balance.amount,
      }))
  }, [balances])

  if (data.length < 2) {
    return <div className="text-center text-gray-400 text-sm py-8">至少需要2次记录才能显示趋势图</div>
  }

  const amounts = data.map((point) => point.amount)
  const dataMin = Math.min(...amounts)
  const dataMax = Math.max(...amounts)
  const padding = (dataMax - dataMin || 1) * 0.15
  const yDomain: [number, number] = scaleMode === 'adaptive'
    ? [dataMin - padding, dataMax + padding]
    : [Math.min(0, dataMin - padding), Math.max(0, dataMax + padding)]

  return (
    <div className="h-52">
      <div className="flex items-center justify-end mb-1">
        <div className="flex rounded-md overflow-hidden border border-gray-200 text-[10px]">
          {(['adaptive', 'zero'] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setScaleMode(mode)}
              className={`px-2 py-0.5 cursor-pointer transition ${scaleMode === mode ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {mode === 'adaptive' ? '自适应' : '包含零点'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
          <XAxis dataKey="_ts" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }} stroke="#c4b5e0"
            tickFormatter={(timestamp: number) => { const date = new Date(timestamp); return `${date.getMonth() + 1}/${date.getDate()}` }} />
          <YAxis domain={yDomain} tick={{ fontSize: 11 }} stroke="#c4b5e0" tickFormatter={formatCompactMoney} width={58} />
          <Tooltip formatter={(value) => [`¥${formatMoney(Number(value))}`, '余额']}
            labelFormatter={(label) => new Date(Number(label)).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} />
          <Area type="monotone" dataKey="amount" fill={`url(#${gradientId})`} stroke="none" legendType="none" tooltipType="none" />
          <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5}
            dot={{ r: 3, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
