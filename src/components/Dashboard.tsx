import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'
import { Wallet, TrendingDown, PiggyBank, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface OverviewData {
  totalAssets: number
  totalInvestments: number
  totalLiabilities: number
  netWorth: number
}

export default function Dashboard() {
  const [data, setData] = useState<OverviewData>({
    totalAssets: 0, totalInvestments: 0, totalLiabilities: 0, netWorth: 0,
  })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOverview()
  }, [])

  const loadOverview = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .returns<Account[]>()

    setAccounts(accountsData || [])
    if (!accountsData || accountsData.length === 0) {
      setLoading(false)
      return
    }

    const accountIds = accountsData.map(a => a.id)
    const { data: balances } = await supabase
      .from('balances')
      .select('*')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: false })
      .returns<Balance[]>()

    if (!balances || balances.length === 0) {
      setData({ totalAssets: 0, totalInvestments: 0, totalLiabilities: 0, netWorth: 0 })
      setLoading(false)
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
    setLoading(false)
  }

  const cards = [
    { label: '总资产', value: data.totalAssets, icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    { label: '总投资', value: data.totalInvestments, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: '总负债', value: data.totalLiabilities, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '净资产', value: data.netWorth, icon: PiggyBank, color: 'text-blue-500', bg: 'bg-blue-50' },
  ]

  const formatMoney = (v: number) => {
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading) return null

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
      <OverviewTrends accounts={accounts} />
    </div>
  )
}

function OverviewTrends({ accounts }: { accounts: Account[] }) {
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTrendData()
  }, [accounts])

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
    const currentAmounts = new Map<string, number>()

    // Build data point for each balance record (chronologically)
    const data: any[] = balances.map(b => {
      currentAmounts.set(b.account_id, b.amount)

      let assets = 0, investments = 0, liabilities = 0
      currentAmounts.forEach((amount, accId) => {
        const type = accountTypeMap.get(accId)
        if (type === 'asset') assets += amount
        else if (type === 'investment') investments += amount
        else liabilities += amount
      })

      return {
        time: new Date(b.recorded_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-4">资产变化趋势</h3>
      <div className="h-64">
        <TrendChartContent data={chartData} />
      </div>
    </div>
  )
}

function TrendChartContent({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#c4b5e0" />
        <YAxis tick={{ fontSize: 11 }} stroke="#c4b5e0" tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} width={50} />
        <Tooltip
          formatter={(value, name) => [`¥${Number(value).toLocaleString()}`, name]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
        />
        <Legend />
        <Line type="monotone" dataKey="资产" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="投资" stroke="#f59e0b" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="负债" stroke="#ef4444" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="净资产" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
