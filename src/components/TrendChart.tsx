import { useId, useMemo, useState } from 'react'
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePrivacyMode } from '../contexts/PrivacyContext'
import { formatCompactMoney, formatMoney, localNoonTimestamp } from '../lib/domain'
import type { Balance } from '../lib/types'

interface Props {
  balances: Balance[]
}

type ScaleMode = 'adaptive' | 'zero'

export default function TrendChart({ balances }: Props) {
  const [scaleMode, setScaleMode] = useState<ScaleMode>('adaptive')
  const { amountsHidden } = usePrivacyMode()
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
    return <div className="py-8 text-center text-sm text-slate-500">至少需要 2 次记录才能显示趋势图</div>
  }

  const amounts = data.map((point) => point.amount)
  const dataMin = Math.min(...amounts)
  const dataMax = Math.max(...amounts)
  const padding = (dataMax - dataMin || 1) * 0.15
  const yDomain: [number, number] = scaleMode === 'adaptive'
    ? [dataMin - padding, dataMax + padding]
    : [Math.min(0, dataMin - padding), Math.max(0, dataMax + padding)]

  const change = data.at(-1)!.amount - data[0].amount
  const chartDescription = `从${formatMoney(data[0].amount)}元变为${formatMoney(data.at(-1)!.amount)}元，变化${change >= 0 ? '增加' : '减少'}${formatMoney(Math.abs(change))}元`

  return (
    <div className="h-56">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {amountsHidden ? '金额已隐藏' : chartDescription}
        </p>
        <div className="flex shrink-0 rounded-xl bg-slate-200/70 p-1 text-[11px]" role="group" aria-label="纵轴范围">
          {(['adaptive', 'zero'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={scaleMode === mode}
              onClick={() => setScaleMode(mode)}
              className={`min-h-7 cursor-pointer rounded-lg px-2 font-medium transition ${scaleMode === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {mode === 'adaptive' ? '自适应' : '包含零点'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-44" role="img" aria-label={amountsHidden ? '账户余额趋势图，金额已隐藏' : chartDescription}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
        <LineChart accessibilityLayer data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 5" stroke="#e2e8f0" strokeOpacity={0.8} />
          <XAxis dataKey="_ts" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false}
            tickFormatter={(timestamp: number) => { const date = new Date(timestamp); return `${date.getMonth() + 1}/${date.getDate()}` }} />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => amountsHidden ? '•••' : formatCompactMoney(value)}
            width={amountsHidden ? 38 : 58}
          />
          <Tooltip
            formatter={(value) => [amountsHidden ? '金额已隐藏' : `¥${formatMoney(Number(value))}`, '余额']}
            labelFormatter={(label) => new Date(Number(label)).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.1)', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            fill={`url(#${gradientId})`}
            stroke="none"
            legendType="none"
            tooltipType="none"
            isAnimationActive={false}
          />
          <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5}
            dot={{ r: 3, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}
