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

  const metricCards = [
    { label: '灵活取用', value: overview.totalAssets, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
    { label: '总投资', value: overview.totalInvestments, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
    { label: '总负债', value: overview.totalLiabilities, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-100' },
    { label: '投资盈亏', value: overview.totalPnl, icon: Zap, color: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-100' },
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
    <div aria-busy={loading} className={`transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-12 lg:gap-4" aria-label="资产概览">
        <div className="relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-200/60 sm:p-6 lg:col-span-4">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-12 h-32 w-32 rounded-full bg-indigo-300/10" />
          <div className="relative">
            <div className="mb-7 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-100">净资产</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <PiggyBank className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <p className="break-all text-3xl font-bold tracking-tight sm:text-4xl">¥{formatMoney(overview.netWorth)}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-blue-100">
              <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/15">{accounts.length} 个账户</span>
              <span>{latest ? `更新至 ${formatSnapshotDate(latest.date)}` : '等待第一笔记录'}</span>
            </div>
          </div>
        </div>

        {metricCards.map((card) => (
          <div key={card.label} className="group col-span-1 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/50 ring-1 ring-slate-100/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 sm:text-sm">{card.label}</span>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.bg} ${card.ring} ring-1 transition group-hover:scale-105`}>
                <card.icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
              </div>
            </div>
            <p className={`break-all text-lg font-bold tracking-tight sm:text-xl ${card.color}`}>¥{formatMoney(card.value)}</p>
          </div>
        ))}
      </section>
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
    <section className="mb-6 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/50 ring-1 ring-slate-100/70 sm:p-6">
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-semibold text-slate-900">{modeLabel}变化趋势</h2>
          <p className="mt-1 text-xs text-slate-400">按日追踪资产变化，掌握财富走势</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex overflow-hidden rounded-xl bg-slate-100 p-1 text-xs">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setChartMode(mode.value)}
                className={`flex-1 cursor-pointer rounded-lg px-3 py-1.5 font-medium transition sm:flex-none ${chartMode === mode.value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {chartMode === 'all' && (
            <div className="flex self-start overflow-hidden rounded-xl bg-slate-100 p-1 text-[11px]">
              {(['adaptive', 'zero'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScaleMode(mode)}
                  className={`cursor-pointer rounded-lg px-2.5 py-1.5 font-medium transition ${scaleMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  {mode === 'adaptive' ? '自适应' : '包含零点'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="h-64 sm:h-72">
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
        <Tooltip
          formatter={(value, name) => [`¥${formatMoney(Number(value))}`, String(name)]}
          labelFormatter={formatChartDate}
          contentStyle={tooltipStyle}
        />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
        <Tooltip formatter={(value) => [`¥${formatMoney(Number(value))}`, dataKey]} labelFormatter={formatChartDate} contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={dataKey} fill={`url(#${gradientId})`} stroke="none" legendType="none" tooltipType="none" />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function ChartAxes({ yDomain }: { yDomain: [number, number] }) {
  return (
    <>
      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e2e8f0" strokeOpacity={0.65} />
      <XAxis
        dataKey="_ts"
        type="number"
        domain={['dataMin', 'dataMax']}
        tick={{ fontSize: 11 }}
        stroke="#cbd5e1"
        tickFormatter={(timestamp: number) => {
          const date = new Date(timestamp)
          return `${date.getMonth() + 1}/${date.getDate()}`
        }}
      />
      <YAxis domain={yDomain} tick={{ fontSize: 11 }} stroke="#cbd5e1" tickFormatter={formatCompactMoney} width={58} />
    </>
  )
}

function formatChartDate(label: unknown): string {
  return new Date(Number(label)).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

function formatSnapshotDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日`
}

const tooltipStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.10)',
  fontSize: 12,
}
