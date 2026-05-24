import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'
import { Wallet, TrendingDown, PiggyBank, TrendingUp } from 'lucide-react'
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area } from 'recharts'

interface OverviewData {
  totalAssets: number
  totalInvestments: number
  totalLiabilities: number
  netWorth: number
}

interface Props {
  refreshKey: number
}

export default function Dashboard({ refreshKey }: Props) {
  const [data, setData] = useState<OverviewData>({
    totalAssets: 0, totalInvestments: 0, totalLiabilities: 0, netWorth: 0,
  })
  const [accounts, setAccounts] = useState<Account[]>([])
  useEffect(() => {
    loadOverview()
  }, [refreshKey])

  const loadOverview = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .returns<Account[]>()

    setAccounts(accountsData || [])
    if (!accountsData || accountsData.length === 0) return

    const accountIds = accountsData.map(a => a.id)
    const { data: balances } = await supabase
      .from('balances')
      .select('*')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: false })
      .returns<Balance[]>()

    if (!balances || balances.length === 0) {
      setData({ totalAssets: 0, totalInvestments: 0, totalLiabilities: 0, netWorth: 0 })
      return
    }

    const latestBalances = new Map<string, number>()
    balances.forEach(b => {
      if (!latestBalances.has(b.account_id)) {
        latestBalances.set(b.account_id, b.amount)
      }
    })

    let totalAssets = 0, totalInvestments = 0, totalLiabilities = 0
    accountsData.forEach(acc => {
      const amount = latestBalances.get(acc.id) || 0
      if (acc.type === 'asset') totalAssets += amount
      else if (acc.type === 'investment') totalInvestments += amount
      else totalLiabilities += amount
    })

    setData({
      totalAssets,
      totalInvestments,
      totalLiabilities,
      netWorth: totalAssets + totalInvestments - totalLiabilities,
    })
  }

  const cards = [
    { label: '灵活取用', value: data.totalAssets, icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    { label: '总投资', value: data.totalInvestments, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: '总负债', value: data.totalLiabilities, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '净资产', value: data.netWorth, icon: PiggyBank, color: 'text-blue-500', bg: 'bg-blue-50' },
  ]

  const formatMoney = (v: number) => {
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-lg font-bold ${card.color}`}>
              ¥{formatMoney(card.value)}
            </p>
          </div>
        ))}
      </div>
      <OverviewTrends accounts={accounts} refreshKey={refreshKey} />
    </div>
  )
}

function OverviewTrends({ accounts, refreshKey }: { accounts: Account[]; refreshKey: number }) {
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scaleMode, setScaleMode] = useState<'adaptive' | 'zero'>('adaptive')
  const [chartMode, setChartMode] = useState<'all' | 'networth'>('all')

  useEffect(() => {
    loadTrendData()
  }, [accounts, refreshKey])

  const loadTrendData = async () => {
    if (accounts.length === 0) { setLoading(false); return }

    const accountIds = accounts.map(a => a.id)
    const { data: balances } = await supabase
      .from('balances')
      .select('*')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true })
      .returns<Balance[]>()

    if (!balances || balances.length === 0) { setLoading(false); return }

    const accountTypeMap = new Map(accounts.map(a => [a.id, a.type]))

    // 按天分组，每个账户每天只保留最后一条记录
    const dayMap = new Map<string, Map<string, number>>()
    balances.forEach((b) => {
      const d = new Date(b.recorded_at)
      const dayKey = `${d.getFullYear()}/${d.getMonth()}/${d.getDate()}`
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map())
      dayMap.get(dayKey)!.set(b.account_id, b.amount)
    })

    // 一天一个数据点，累计状态
    const sortedDays = Array.from(dayMap.keys()).sort()
    const currentAmounts = new Map<string, number>()
    const data = sortedDays.map((dayKey) => {
      const dayBalances = dayMap.get(dayKey)!
      dayBalances.forEach((amount, accId) => {
        currentAmounts.set(accId, amount)
      })

      let assets = 0, investments = 0, liabilities = 0
      currentAmounts.forEach((amount, accId) => {
        const type = accountTypeMap.get(accId)
        if (type === 'asset') assets += amount
        else if (type === 'investment') investments += amount
        else liabilities += amount
      })

      const [y, m, d] = dayKey.split('/').map(Number)
      const noonTs = new Date(y, m, d, 12, 0, 0).getTime()

      return {
        _ts: noonTs,
        资产: assets,
        投资: investments,
        负债: liabilities,
        净资产: assets + investments - liabilities,
      }
    })

    setChartData(data)
    setLoading(false)
  }

  if (loading || chartData.length === 0) return null

  // Compute Y domain
  const allValues = chartData.flatMap(d => [d.资产, d.投资, d.负债, d.净资产])
  const dataMin = Math.min(...allValues)
  const dataMax = Math.max(...allValues)
  const range = dataMax - dataMin || 1
  const padding = range * 0.15
  const yDomain: [number, number] = scaleMode === 'adaptive'
    ? [dataMin - padding, dataMax + padding]
    : [0, dataMax + padding]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-600">
          {chartMode === 'all' ? '资产变化趋势' : '净资产变化趋势'}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-gray-200 text-[10px]">
            <button
              onClick={() => setChartMode('all')}
              className={`px-2 py-0.5 cursor-pointer transition ${chartMode === 'all' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              总览
            </button>
            <button
              onClick={() => setChartMode('networth')}
              className={`px-2 py-0.5 cursor-pointer transition ${chartMode === 'networth' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              净资产
            </button>
          </div>
          {chartMode === 'all' && (
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
          )}
        </div>
      </div>
      <div className="h-64">
        {chartMode === 'all' ? (
          <TrendChartContent data={chartData} yDomain={yDomain} />
        ) : (
          <NetWorthChartContent data={chartData} />
        )}
      </div>
    </div>
  )
}

function TrendChartContent({ data, yDomain }: { data: any[]; yDomain: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
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
          tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`}
          width={50}
        />
        <Tooltip
          formatter={(value, name) => [`¥${Number(value).toLocaleString()}`, name]}
          labelFormatter={(label) => new Date(Number(label)).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        />
        <Legend iconType="plainline" />
        <Area type="monotone" dataKey="资产" fill="url(#greenGrad)" stroke="#22c55e" strokeWidth={2.5} dot={false} />
        <Area type="monotone" dataKey="投资" fill="url(#amberGrad)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
        <Area type="monotone" dataKey="负债" fill="url(#redGrad)" stroke="#ef4444" strokeWidth={2.5} dot={false} />
        <Area type="monotone" dataKey="净资产" fill="url(#blueGrad)" stroke="#3b82f6" strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function NetWorthChartContent({ data }: { data: any[] }) {
  const values = data.map(d => d.净资产)
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const range = dataMax - dataMin || 1
  const padding = range * 0.18
  const yDomain: [number, number] = [dataMin - padding, dataMax + padding]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
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
          tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`}
          width={50}
        />
        <Tooltip
          formatter={(value) => [`¥${Number(value).toLocaleString()}`, '净资产']}
          labelFormatter={(label) => new Date(Number(label)).toLocaleString('zh-CN', { month: 'long', day: 'numeric' })}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        />
        <Area type="monotone" dataKey="净资产" fill="url(#nwGrad)" stroke="#3b82f6" strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
