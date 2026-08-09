import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleGauge,
  Minus,
  PiggyBank,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  Area,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { usePrivacyMode } from '../contexts/PrivacyContext'
import {
  calculateAccountContributions,
  calculateChange,
  DEFAULT_BALANCE_STALE_DAYS,
  filterSnapshotsByDays,
  filterSnapshotsFromDate,
  formatCompactMoney,
  formatMoney,
  formatSignedMoney,
  getBalanceFreshness,
  localDateString,
  summarizeBalances,
  type DailySnapshot,
} from '../lib/domain'
import type { Account, Balance } from '../lib/types'
import Money from './ui/Money'

interface Props {
  accounts: Account[]
  balancesByAccount: ReadonlyMap<string, Balance[]>
  snapshots: DailySnapshot[]
  loading: boolean
}

interface ChartPoint {
  _ts: number
  净资产: number
  总资产: number
  负债: number
}

type ChartMode = 'networth' | 'balance'
type RangeKey = '30d' | '90d' | 'ytd' | 'all'

const rangeOptions: { value: RangeKey; label: string }[] = [
  { value: '30d', label: '1月' },
  { value: '90d', label: '3月' },
  { value: 'ytd', label: '今年' },
  { value: 'all', label: '全部' },
]
const axisDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
})
const chartDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export default function Dashboard({ accounts, balancesByAccount, snapshots, loading }: Props) {
  const [range, setRange] = useState<RangeKey>('90d')
  const today = localDateString()
  const currentSnapshots = useMemo(
    () => snapshots.filter((snapshot) => snapshot.date <= today),
    [snapshots, today],
  )
  const visibleSnapshots = useMemo(
    () => {
      if (range === 'ytd') {
        return filterSnapshotsFromDate(currentSnapshots, `${today.slice(0, 4)}-01-01`)
      }
      return filterSnapshotsByDays(
        currentSnapshots,
        range === '30d' ? 30 : range === '90d' ? 90 : null,
        today,
      )
    },
    [currentSnapshots, range, today],
  )
  const latest = currentSnapshots.at(-1)
  const periodStart = visibleSnapshots.at(0)
  const periodChange = latest && periodStart && latest.date !== periodStart.date
    ? calculateChange(latest.netWorth, periodStart.netWorth)
    : null

  if (loading && currentSnapshots.length === 0) return <DashboardSkeleton />
  if (accounts.length === 0) return null
  if (currentSnapshots.length === 0) {
    return (
      <GettingStartedState
        title="账户已就绪，补上当前余额"
        description={`你已经添加 ${accounts.length} 个账户。集中记录一次当前余额，就能生成第一份净资产概览。`}
      />
    )
  }

  const overview = latest ?? {
    totalAssets: 0,
    totalInvestments: 0,
    totalLiabilities: 0,
    totalPnl: 0,
    netWorth: 0,
  }

  const metricCards = [
    {
      label: '灵活取用',
      hint: '现金与活期资产',
      value: overview.totalAssets,
      icon: Wallet,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      label: '投资资产',
      hint: '长期与市场投资',
      value: overview.totalInvestments,
      icon: TrendingUp,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      label: '总负债',
      hint: '当前待偿还金额',
      value: overview.totalLiabilities,
      icon: TrendingDown,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
    },
    {
      label: '投资盈亏',
      hint: '单独记录的收益',
      value: overview.totalPnl,
      icon: Zap,
      color: overview.totalPnl < 0 ? 'text-rose-700' : 'text-violet-700',
      bg: overview.totalPnl < 0 ? 'bg-rose-50' : 'bg-violet-50',
    },
  ]

  return (
    <section aria-busy={loading} aria-labelledby="overview-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-600">财务概览</p>
          <h2 id="overview-title" className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
            看清资产，也看懂变化
          </h2>
        </div>
        <p className="hidden text-sm text-slate-500 sm:block">
          {latest
            ? `最近记录日 ${formatSnapshotDate(latest.date)} · 当日确认 ${latest.records.size}/${accounts.length}`
            : '等待第一笔余额记录'}
        </p>
      </div>

      <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-12">
        <div className="relative min-w-0 overflow-hidden rounded-[1.25rem] bg-[linear-gradient(135deg,#172554_0%,#1d4ed8_58%,#4f46e5_100%)] p-5 text-white shadow-[0_18px_45px_rgba(30,64,175,0.22)] sm:p-7 lg:col-span-5">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.06]" />
          <div className="absolute -bottom-28 right-8 h-56 w-56 rounded-full bg-indigo-300/10 blur-xl" />
          <div className="relative flex h-full min-h-52 flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-100">当前净资产</p>
                <p className="mt-1 text-xs text-blue-200/80">资产与投资减去负债</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                <PiggyBank className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <div className="my-7">
              <Money
                value={overview.netWorth}
                className="block overflow-hidden text-ellipsis text-3xl font-bold tracking-tight sm:text-4xl"
              />
              <PeriodChange change={periodChange} range={range} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-100">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
                {accounts.length} 个账户
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
                最近记录日实际填写 {latest?.records.size ?? 0}/{accounts.length}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
                {currentSnapshots.length} 个记录日
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 lg:col-span-7">
          {metricCards.map((card) => (
            <article
              key={card.label}
              className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">{card.label}</h3>
                  <p className="mt-1 hidden text-xs text-slate-500 sm:block">{card.hint}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                  <card.icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <Money
                value={card.value}
                className={`block overflow-hidden text-ellipsis text-base font-bold tracking-tight sm:text-xl ${card.color}`}
              />
            </article>
          ))}
        </div>
      </div>

      <InsightBar
        accounts={accounts}
        balancesByAccount={balancesByAccount}
        data={visibleSnapshots}
        range={range}
      />

      <div className="mb-6 grid min-w-0 gap-4 xl:grid-cols-12">
        <OverviewTrends
          data={visibleSnapshots}
          range={range}
          onRangeChange={setRange}
          className="xl:col-span-8"
        />
        <StructureCard snapshot={latest} className="xl:col-span-4" />
      </div>
    </section>
  )
}

function PeriodChange({
  change,
  range,
}: {
  change: ReturnType<typeof calculateChange> | null
  range: RangeKey
}) {
  const { amountsHidden } = usePrivacyMode()
  const label = getRangeLabel(range)

  if (!change) {
    return <p className="mt-3 text-sm text-blue-100/80">再记录一次即可比较变化</p>
  }

  if (change.amount === 0) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 font-semibold text-blue-100">
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          {amountsHidden ? '金额已隐藏' : formatSignedMoney(0)}
        </span>
        <span className="text-blue-100/75">{label} · 持平</span>
      </div>
    )
  }

  const rising = change.amount >= 0
  const Icon = rising ? ArrowUpRight : ArrowDownRight
  const amount = amountsHidden ? '金额已隐藏' : formatSignedMoney(change.amount)
  const percentage = change.percentage === null
    ? ''
    : ` · ${change.percentage > 0 ? '+' : ''}${change.percentage.toFixed(1)}%`

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${rising ? 'bg-emerald-400/15 text-emerald-100' : 'bg-rose-400/15 text-rose-100'}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {amount}{amountsHidden ? '' : percentage}
      </span>
      <span className="text-blue-100/75">{label}</span>
    </div>
  )
}

function InsightBar({
  accounts,
  balancesByAccount,
  data,
  range,
}: {
  accounts: Account[]
  balancesByAccount: ReadonlyMap<string, Balance[]>
  data: DailySnapshot[]
  range: RangeKey
}) {
  if (accounts.length === 0) return null

  const start = data.at(0)
  const end = data.at(-1)
  const change = start && end && start.date !== end.date
    ? calculateChange(end.netWorth, start.netWorth)
    : null
  const contributions = calculateAccountContributions(accounts, start, end)
  const primaryContribution = contributions.at(0)
  const newlyCoveredCount = contributions.filter((contribution) => contribution.isNewInPeriod).length
  const primaryAccount = primaryContribution
    ? accounts.find((account) => account.id === primaryContribution.accountId)
    : undefined
  const freshCount = accounts.filter((account) => {
    const current = summarizeBalances(balancesByAccount.get(account.id) ?? []).current
    return getBalanceFreshness(current?.recorded_on ?? null).status === 'fresh'
  }).length
  const attentionCount = accounts.length - freshCount
  const HealthIcon = attentionCount > 0 ? AlertTriangle : CheckCircle2

  return (
    <aside className="mb-4 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between" aria-label="资产洞察摘要">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-blue-700">本期洞察</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {change ? (
              <>
                {change.amount === 0 ? (
                  <>{getRangeLabel(range)}净资产记录值保持不变</>
                ) : (
                  <>
                    {getRangeLabel(range)}净资产记录值{change.amount > 0 ? '增加' : '减少'}{' '}
                    <Money value={Math.abs(change.amount)} className="font-semibold text-slate-900" />
                  </>
                )}
                {primaryContribution && primaryAccount && (
                  <>
                    ；绝对变化最大的是{' '}
                    <a href={`#account-${primaryAccount.id}`} className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-2 hover:text-blue-800">
                      {primaryAccount.name}
                    </a>{' '}
                    （<Money value={primaryContribution.amount} signed className="font-semibold" />
                    {primaryContribution.isNewInPeriod ? '，本期新增记录' : ''}）
                  </>
                )}
                {newlyCoveredCount > 0 && (
                  <>；含 {newlyCoveredCount} 个首次纳入账户，属于数据覆盖变化，不能直接视为收益</>
                )}
                。
              </>
            ) : (
              data.length === 0
                ? <>所选时间范围内没有记录；可切换“全部”查看更早的历史。</>
                : <>所选范围至少需要两个不同记录日，才能解释净资产变化来源。</>
            )}
          </p>
        </div>
      </div>

      <a
        href="#account-review"
        className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${attentionCount > 0 ? 'border-amber-200 text-amber-800' : 'border-emerald-200 text-emerald-800'}`}
      >
        <HealthIcon className="h-4 w-4" aria-hidden="true" />
        <span>
          近期覆盖：<strong className="font-semibold">{freshCount}/{accounts.length}</strong> 个账户在 {DEFAULT_BALANCE_STALE_DAYS} 天内有记录
          {attentionCount > 0 && <span className="font-semibold"> · {attentionCount} 个待确认</span>}
        </span>
      </a>
    </aside>
  )
}

function OverviewTrends({
  data,
  range,
  onRangeChange,
  className,
}: {
  data: DailySnapshot[]
  range: RangeKey
  onRangeChange: (range: RangeKey) => void
  className?: string
}) {
  const [chartMode, setChartMode] = useState<ChartMode>('networth')
  const { amountsHidden } = usePrivacyMode()
  const chartData: ChartPoint[] = data.map((snapshot) => ({
    _ts: snapshot.timestamp,
    净资产: snapshot.netWorth,
    总资产: snapshot.totalAssets + snapshot.totalInvestments,
    负债: snapshot.totalLiabilities,
  }))
  const start = data.at(0)
  const end = data.at(-1)
  const change = start && end ? calculateChange(end.netWorth, start.netWorth) : null
  const values = chartData.flatMap((point) => (
    chartMode === 'networth' ? [point.净资产] : [point.总资产, point.负债]
  ))
  const dataMin = values.length ? Math.min(...values) : 0
  const dataMax = values.length ? Math.max(...values) : 0
  const padding = (dataMax - dataMin || Math.max(Math.abs(dataMax), 1)) * 0.14
  const yDomain: [number, number] = chartMode === 'networth'
    ? [dataMin - padding, dataMax + padding]
    : [Math.min(0, dataMin - padding), dataMax + padding]
  const curveType = chartData.length <= 3 ? 'linear' : 'monotone'
  const chartDescription = change
    ? change.amount === 0
      ? '所选期间净资产保持不变'
      : `所选期间净资产${change.amount > 0 ? '增加' : '减少'}${formatMoney(Math.abs(change.amount))}元`
    : '当前记录不足，暂时无法比较趋势'
  const observationLabel = start && end
    ? `${formatSnapshotRange(start.date, end.date)} · ${chartData.length} 个记录日`
    : '等待记录数据'

  return (
    <article className={`min-w-0 rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 ${className ?? ''}`}>
      <div className="mb-5 flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h3 className="font-semibold text-slate-900">资产趋势</h3>
            <p className="mt-1 text-sm text-slate-500">
              {amountsHidden ? '金额已隐藏，趋势形态仍然可见' : chartDescription}
            </p>
            <p className="mt-1 text-xs text-slate-400">{observationLabel}</p>
          </div>
          <SegmentedControl
            label="图表指标"
            value={chartMode}
            onChange={setChartMode}
            options={[
              { value: 'networth', label: '净资产' },
              { value: 'balance', label: '资产 / 负债' },
            ]}
          />
        </div>
        <SegmentedControl
          label="时间范围"
          value={range}
          onChange={onRangeChange}
          options={rangeOptions.map((option) => ({ value: option.value, label: option.label }))}
          compact
        />
      </div>

      {chartData.length < 2 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
          <TrendingUp className="mb-3 h-7 w-7 text-slate-300" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600">
            {chartData.length === 0 ? '所选范围暂无记录' : '再记录一次即可形成趋势'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {chartData.length === 0 ? '切换到更长时间范围，或记录今天的余额' : '每次更新都会沉淀为一条历史轨迹'}
          </p>
        </div>
      ) : (
        <div
          className="h-64 sm:h-72"
          role="img"
          aria-label={amountsHidden ? '资产趋势图，金额已隐藏' : chartDescription}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
            <LineChart accessibilityLayer data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="net-worth-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4 5" stroke="#e2e8f0" strokeOpacity={0.85} />
              <XAxis
                dataKey="_ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisDate}
                minTickGap={28}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => amountsHidden ? '•••' : formatCompactMoney(value)}
                width={amountsHidden ? 38 : 62}
              />
              <Tooltip
                formatter={(value, name) => [
                  amountsHidden ? '金额已隐藏' : `¥${formatMoney(Number(value))}`,
                  String(name),
                ]}
                labelFormatter={formatChartDate}
                contentStyle={tooltipStyle}
                cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
              />
              {chartMode === 'networth' ? (
                <>
                  <Area
                    type={curveType}
                    dataKey="净资产"
                    fill="url(#net-worth-fill)"
                    stroke="none"
                    legendType="none"
                    tooltipType="none"
                    isAnimationActive={false}
                  />
                  <Line
                    type={curveType}
                    dataKey="净资产"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={chartData.length <= 12 ? { r: 3, fill: '#fff', stroke: '#2563eb', strokeWidth: 2 } : false}
                    activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 3 }}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <>
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line
                    type={curveType}
                    dataKey="总资产"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type={curveType}
                    dataKey="负债"
                    stroke="#e11d48"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  )
}

function StructureCard({
  snapshot,
  className,
}: {
  snapshot: DailySnapshot | undefined
  className?: string
}) {
  const { amountsHidden } = usePrivacyMode()
  const assets = snapshot?.totalAssets ?? 0
  const investments = snapshot?.totalInvestments ?? 0
  const liabilities = snapshot?.totalLiabilities ?? 0
  const holdings = assets + investments
  const debtRatio = holdings > 0 ? (liabilities / holdings) * 100 : null
  const allocation = [
    { name: '灵活取用', value: assets, color: '#059669' },
    { name: '投资资产', value: investments, color: '#d97706' },
  ].filter((item) => item.value > 0)
  const debtStatus = liabilities === 0
    ? { label: '当前无负债', tone: 'text-emerald-700', bar: 'bg-emerald-500' }
    : debtRatio !== null && debtRatio <= 100
      ? { label: '资产目前可覆盖负债', tone: 'text-blue-700', bar: 'bg-blue-500' }
      : debtRatio === null
        ? { label: '暂无资产覆盖负债', tone: 'text-rose-700', bar: 'bg-rose-500' }
        : { label: '负债已高于资产', tone: 'text-rose-700', bar: 'bg-rose-500' }

  return (
    <article className={`min-w-0 rounded-[1.25rem] border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 ${className ?? ''}`}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">资产构成</h3>
          <p className="mt-1 text-sm text-slate-500">了解资金主要分布在哪里</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <CircleGauge className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      {allocation.length === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
          添加余额后显示资产构成
        </div>
      ) : (
        <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <PieChart accessibilityLayer>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={62}
                  paddingAngle={4}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {allocation.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip
                  formatter={(value) => [amountsHidden ? '金额已隐藏' : `¥${formatMoney(Number(value))}`, '金额']}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {allocation.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-semibold text-slate-800">
                  {holdings > 0 ? `${((item.value / holdings) * 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">负债 / 资产</p>
            <p className={`mt-1 text-sm font-semibold ${debtStatus.tone}`}>{debtStatus.label}</p>
          </div>
          <span className="text-lg font-bold tabular-nums text-slate-800">
            {debtRatio === null ? '—' : `${debtRatio.toFixed(1)}%`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${debtStatus.bar}`}
            style={{ width: `${debtRatio === null ? (liabilities > 0 ? 100 : 0) : Math.min(debtRatio, 100)}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          资产合计 <Money value={holdings} className="font-semibold text-slate-700" />
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">仅反映账面结构，不代表现金流或实际偿债能力。</p>
      </div>
    </article>
  )
}

function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  compact = false,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  compact?: boolean
}) {
  return (
    <div className={`flex self-start rounded-xl bg-slate-100 p-1 ${compact ? 'text-xs' : 'text-xs'}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-8 cursor-pointer rounded-lg px-3 font-medium transition ${
            value === option.value
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <section aria-label="资产概览加载中" aria-busy="true">
      <div className="mb-4 space-y-2">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-12">
        <div className="h-64 animate-pulse rounded-[1.25rem] bg-slate-200 lg:col-span-5" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-7">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-[7.75rem] animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="h-96 animate-pulse rounded-[1.25rem] bg-white xl:col-span-8" />
        <div className="h-96 animate-pulse rounded-[1.25rem] bg-white xl:col-span-4" />
      </div>
    </section>
  )
}

function GettingStartedState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section aria-labelledby="overview-title" className="overflow-hidden rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#eef2ff_100%)] px-5 py-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8 sm:py-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          <PiggyBank className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold text-blue-600">开始建立资产轨迹</p>
        <h2 id="overview-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </section>
  )
}

function formatAxisDate(timestamp: number): string {
  return axisDateFormatter.format(new Date(timestamp))
}

function formatChartDate(label: unknown): string {
  return chartDateFormatter.format(new Date(Number(label)))
}

function formatSnapshotDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

function formatSnapshotRange(startDate: string, endDate: string): string {
  const [startYear, startMonth, startDay] = startDate.split('-')
  const [endYear, endMonth, endDay] = endDate.split('-')
  if (startYear === endYear) {
    return `${startYear}年${Number(startMonth)}月${Number(startDay)}日 – ${Number(endMonth)}月${Number(endDay)}日`
  }
  return `${formatSnapshotDate(startDate)} – ${formatSnapshotDate(endDate)}`
}

function getRangeLabel(range: RangeKey): string {
  if (range === '30d') return '近 1 个月'
  if (range === '90d') return '近 3 个月'
  if (range === 'ytd') return '今年'
  return '全部记录'
}

const tooltipStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
  fontSize: 12,
}
