import { useMemo, useState } from 'react'
import { PiggyBank, TrendingDown, TrendingUp, Wallet, Zap } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildDailySnapshots, formatCompactMoney, formatMoney } from '../lib/domain'
import type { Account, Balance } from '../lib/types'

interface Props {
  accounts: Account[]
  balances: Balance[]
  loading: boolean
}

interface ChartPoint {
  _ts: number
  资产: number
  投资: number
  负债: number
  净资产: number
  投资盈亏: number
}

type ChartMode = 'all' | 'networth' | 'investment' | 'pnl'
type MetricKey = '净资产' | '投资' | '投资盈亏'

const emptyOverview = {
  totalAssets: 0,
  totalInvestments: 0,
  totalLiabilities: 0,
  netWorth: 0,
  totalPnl: 0,
}

export default function Dashboard({ accounts, balances, loading }: Props) {
  const snapshots = useMemo(() => buildDailySnapshots(accounts, balances), [accounts, balances])
  const latest = snapshots.at(-1)
  const overview = latest ?? emptyOverview

  const cards = [
    { label: '灵活取用', value: overview.totalAssets, icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    { label: '总投资', value: overview.totalInvestments, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: '总负债', value: overview.totalLiabilities, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '净资产', value: overview.netWorth, icon: PiggyBank, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: '投资盈亏', value: overview.totalPnl, icon: Zap, color: 'text-violet-500', bg: 'bg-violet-50' },
  ]

  const chartData: ChartPoint[] = snapshots.map((snapshot) => ({
    _ts: snapshot.timestamp,
    资产: snapshot.totalAssets,
    投资: snapshot.totalInvestments,
    负债: snapshot.totalLiabilities,
    净资产: snapshot.netWorth,
    投资盈亏: snapshot.totalPnl,
  }))

  return (
    <div aria-busy={loading}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-lg font-bold ${card.color}`}>¥{formatMoney(card.value)}</p>
          </div>
        ))}
      </div>
      <OverviewTrends data={chartData} />
    </div>
  )
}

function OverviewTrends({ data }: { data: ChartPoint[] }) {
  const [scaleMode, setScaleMode] = useState<'adaptive' | 'zero'>('adaptive')
  const [chartMode, setChartMode] = useState<ChartMode>('all')

  if (data.length === 0) return null

  const allValues = data.flatMap((point) => [point.资产, point.投资, point.负债, point.净资产])
  const dataMin = Math.min(...allValues)
  const dataMax = Math.max(...allValues)
  const padding = (dataMax - dataMin || 1) * 0.15
  const yDomain: [number, number] = scaleMode === 'adaptive'
    ? [dataMin - padding, dataMax + padding]
    : [Math.min(0, dataMin - padding), Math.max(0, dataMax + padding)]

  const modes: { value: ChartMode; label: string }[] = [
    { value: 'all', label: '总览' },
    { value: 'networth', label: '净资产' },
    { value: 'investment', label: '投资' },
    { value: 'pnl', label: '投资盈亏' },
  ]
  const modeLabel = modes.find((mode) => mode.value === chartMode)?.label ?? '总览'

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-600">{modeLabel}变化趋势</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-gray-200 text-[10px]">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setChartMode(mode.value)}
                className={`px-2 py-1 cursor-pointer transition ${chartMode === mode.value ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {chartMode === 'all' && (
            <div className="flex rounded-md overflow-hidden border border-gray-200 text-[10px]">
              {(['adaptive', 'zero'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScaleMode(mode)}
                  className={`px-2 py-1 cursor-pointer transition ${scaleMode === mode ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {mode === 'adaptive' ? '自适应' : '包含零点'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="h-64">
        {chartMode === 'all' && <OverviewChart data={data} yDomain={yDomain} />}
        {chartMode === 'networth' && <SingleMetricChart data={data} dataKey="净资产" color="#3b82f6" gradientId="net-worth-gradient" />}
        {chartMode === 'investment' && <SingleMetricChart data={data} dataKey="投资" color="#f59e0b" gradientId="investment-gradient" />}
        {chartMode === 'pnl' && <SingleMetricChart data={data} dataKey="投资盈亏" color="#8b5cf6" gradientId="pnl-gradient" />}
      </div>
    </section>
  )
}

function OverviewChart({ data, yDomain }: { data: ChartPoint[]; yDomain: [number, number] }) {
  const series = [
    { key: '资产', color: '#22c55e', gradient: 'asset-gradient' },
    { key: '投资', color: '#f59e0b', gradient: 'overview-investment-gradient' },
    { key: '负债', color: '#ef4444', gradient: 'liability-gradient' },
    { key: '净资产', color: '#3b82f6', gradient: 'overview-net-worth-gradient' },
  ] as const

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          {series.map((item) => (
            <linearGradient key={item.gradient} id={item.gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={item.color} stopOpacity={0.01} />
            </linearGradient>
          ))}
        </defs>
        <ChartAxes yDomain={yDomain} />
        <Tooltip formatter={(value, name) => [`¥${formatMoney(Number(value))}`, String(name)]} labelFormatter={formatChartDate} />
        <Legend iconType="plainline" />
        {series.map((item) => (
          <Area key={`${item.key}-area`} type="monotone" dataKey={item.key} fill={`url(#${item.gradient})`} stroke="none" legendType="none" tooltipType="none" />
        ))}
        {series.map((item) => (
          <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={item.key === '净资产' ? 3 : 2.5} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function SingleMetricChart({
  data,
  dataKey,
  color,
  gradientId,
}: {
  data: ChartPoint[]
  dataKey: MetricKey
  color: string
  gradientId: string
}) {
  const values = data.map((point) => point[dataKey])
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const padding = (dataMax - dataMin || 1) * 0.18
  const domain: [number, number] = [dataMin - padding, dataMax + padding]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <ChartAxes yDomain={domain} />
        <Tooltip formatter={(value) => [`¥${formatMoney(Number(value))}`, dataKey]} labelFormatter={formatChartDate} />
        <Area type="monotone" dataKey={dataKey} fill={`url(#${gradientId})`} stroke="none" legendType="none" tooltipType="none" />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function ChartAxes({ yDomain }: { yDomain: [number, number] }) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
      <XAxis
        dataKey="_ts"
        type="number"
        domain={['dataMin', 'dataMax']}
        tick={{ fontSize: 11 }}
        stroke="#c4b5e0"
        tickFormatter={(timestamp: number) => {
          const date = new Date(timestamp)
          return `${date.getMonth() + 1}/${date.getDate()}`
        }}
      />
      <YAxis domain={yDomain} tick={{ fontSize: 11 }} stroke="#c4b5e0" tickFormatter={formatCompactMoney} width={58} />
    </>
  )
}

function formatChartDate(label: unknown): string {
  return new Date(Number(label)).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}
