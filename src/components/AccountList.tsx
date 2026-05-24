import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Account, Balance } from '../lib/types'
import { Plus, Edit3, Trash2, History, TrendingUp, Calendar, Table2, LayoutGrid } from 'lucide-react'
import * as Icons from 'lucide-react'
import AddAccountModal from './AddAccountModal'
import RecordBalanceModal from './RecordBalanceModal'
import TrendChart from './TrendChart'
import BalanceHistory from './BalanceHistory'
import BatchRecordModal from './BatchRecordModal'
import HistoryTable from './HistoryTable'

interface Props {
  onRecorded: () => void
}

type ViewMode = 'cards' | 'table'

export default function AccountList({ onRecorded }: Props) {
  const [accounts, setAccounts] = useState<(Account & { latest_balance: number | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [recordAccount, setRecordAccount] = useState<Account | null>(null)
  const [historyAccount, setHistoryAccount] = useState<{ id: string; name: string } | null>(null)
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Account[]>()

    if (!accountsData || accountsData.length === 0) {
      setAccounts([])
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

    const latestBalances = new Map<string, number>()
    if (balances) {
      balances.forEach(b => {
        if (!latestBalances.has(b.account_id)) {
          latestBalances.set(b.account_id, b.amount)
        }
      })
    }

    const merged = accountsData.map(a => ({
      ...a,
      latest_balance: latestBalances.get(a.id) ?? null,
    }))

    setAccounts(merged)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个账户吗？所有历史记录也会被删除。')) return
    await supabase.from('balances').delete().eq('account_id', id)
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  const toggleChart = (id: string) => {
    setExpandedCharts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderIcon = (iconName: string, className = 'w-5 h-5') => {
    const IconComponent = (Icons as any)[iconName]
    return IconComponent ? <IconComponent className={className} /> : null
  }

  const formatMoney = (v: number) => {
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-12">加载中...</div>
  }

  const assetAccounts = accounts.filter(a => a.type === 'asset')
  const investmentAccounts = accounts.filter(a => a.type === 'investment')
  const liabilityAccounts = accounts.filter(a => a.type === 'liability')

  return (
    <div>
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex rounded-md overflow-hidden border border-gray-200 text-xs">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 cursor-pointer transition flex items-center gap-1 ${viewMode === 'cards' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> 卡片
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 cursor-pointer transition flex items-center gap-1 ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <Table2 className="w-3.5 h-3.5" /> 表格
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
          >
            <Calendar className="w-4 h-4" /> 批量记录
          </button>
          {viewMode === 'cards' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" /> 添加
            </button>
          )}
        </div>
      </div>

      {/* 表格视图 */}
      {viewMode === 'table' && (
        <HistoryTable onRecorded={onRecorded} />
      )}

      {/* 卡片视图 */}
      {viewMode === 'cards' && (<>
      {/* 资产账户 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-green-600 uppercase tracking-wide">资产账户</h2>
        </div>

        {assetAccounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400 mb-3">还没有资产账户</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium cursor-pointer"
            >
              + 添加第一个账户
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assetAccounts.map(acc => (
              <AccountCard
                key={acc.id}
                account={acc}
                formatMoney={formatMoney}
                renderIcon={renderIcon}
                onRecord={() => setRecordAccount(acc)}
                onEdit={() => setEditAccount(acc)}
                onDelete={() => handleDelete(acc.id)}
                onHistory={() => setHistoryAccount({ id: acc.id, name: acc.name })}
                onToggleChart={() => toggleChart(acc.id)}
                showChart={expandedCharts.has(acc.id)}
                chartType="asset"
              />
            ))}
          </div>
        )}
      </div>

      {/* 投资账户 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-amber-500 uppercase tracking-wide">投资账户</h2>
        </div>

        {investmentAccounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400 mb-3">还没有投资账户</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium cursor-pointer"
            >
              + 添加第一个账户
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {investmentAccounts.map(acc => (
              <AccountCard
                key={acc.id}
                account={acc}
                formatMoney={formatMoney}
                renderIcon={renderIcon}
                onRecord={() => setRecordAccount(acc)}
                onEdit={() => setEditAccount(acc)}
                onDelete={() => handleDelete(acc.id)}
                onHistory={() => setHistoryAccount({ id: acc.id, name: acc.name })}
                onToggleChart={() => toggleChart(acc.id)}
                showChart={expandedCharts.has(acc.id)}
                chartType="investment"
              />
            ))}
          </div>
        )}
      </div>

      {/* 负债账户 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide">负债账户</h2>
        </div>

        {liabilityAccounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400 mb-3">还没有负债账户</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium cursor-pointer"
            >
              + 添加第一个账户
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {liabilityAccounts.map(acc => (
              <AccountCard
                key={acc.id}
                account={acc}
                formatMoney={formatMoney}
                renderIcon={renderIcon}
                onRecord={() => setRecordAccount(acc)}
                onEdit={() => setEditAccount(acc)}
                onDelete={() => handleDelete(acc.id)}
                onHistory={() => setHistoryAccount({ id: acc.id, name: acc.name })}
                onToggleChart={() => toggleChart(acc.id)}
                showChart={expandedCharts.has(acc.id)}
                chartType="liability"
              />
            ))}
          </div>
        )}
      </div>

      {/* 空状态 */}
      {accounts.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-4">还没有任何账户，开始记录你的资产吧</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition cursor-pointer"
          >
            添加账户
          </button>
        </div>
      )}

      {/* 弹窗 */}
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); loadAccounts() }}
        />
      )}
      {editAccount && (
        <AddAccountModal
          editAccount={editAccount}
          onClose={() => setEditAccount(null)}
          onSaved={() => { setEditAccount(null); loadAccounts() }}
        />
      )}
      {recordAccount && (
        <RecordBalanceModal
          account={recordAccount}
          onClose={() => setRecordAccount(null)}
          onSaved={() => { setRecordAccount(null); loadAccounts(); onRecorded() }}
        />
      )}
      {historyAccount && (
        <BalanceHistory
          accountId={historyAccount.id}
          accountName={historyAccount.name}
          onClose={() => setHistoryAccount(null)}
        />
      )}
      {showBatchModal && (
        <BatchRecordModal
          accounts={accounts}
          onClose={() => setShowBatchModal(false)}
          onSaved={() => { setShowBatchModal(false); loadAccounts(); onRecorded() }}
        />
      )}
      </>)}
    </div>
  )
}

function AccountCard({
  account,
  formatMoney,
  renderIcon,
  onRecord,
  onEdit,
  onDelete,
  onHistory,
  onToggleChart,
  showChart,
  chartType,
}: {
  account: Account & { latest_balance: number | null }
  formatMoney: (v: number) => string
  renderIcon: (icon: string, className?: string) => React.ReactNode
  onRecord: () => void
  onEdit: () => void
  onDelete: () => void
  onHistory: () => void
  onToggleChart: () => void
  showChart: boolean
  chartType: 'asset' | 'investment' | 'liability'
}) {
  const colorMap = { asset: 'text-green-600', investment: 'text-amber-500', liability: 'text-red-500' }
  const bgMap = { asset: 'bg-green-50', investment: 'bg-amber-50', liability: 'bg-red-50' }
  const colorClass = colorMap[chartType]
  const bgClass = bgMap[chartType]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center`}>
              <span className={colorClass}>{renderIcon(account.icon)}</span>
            </div>
            <div>
              <p className="font-semibold text-gray-800">{account.name}</p>
              <p className="text-xs text-gray-400">
                {account.latest_balance !== null ? '最新余额' : '暂无记录'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${colorClass}`}>
              {account.latest_balance !== null ? `¥${formatMoney(account.latest_balance)}` : '-'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 border-t border-gray-50 pt-3">
          <button
            onClick={onRecord}
            className="flex-1 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-50 rounded-md transition cursor-pointer"
          >
            记一笔
          </button>
          <button
            onClick={onHistory}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition cursor-pointer"
            title="查看历史"
          >
            <History className="w-3.5 h-3.5" /> 历史
          </button>
          <button
            onClick={onToggleChart}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition cursor-pointer ${
              showChart ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
            title="趋势图"
          >
            <TrendingUp className="w-3.5 h-3.5" /> 趋势
          </button>
          <button
            onClick={onEdit}
            className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition cursor-pointer"
            title="编辑"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition cursor-pointer"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showChart && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
          <TrendChart accountId={account.id} />
        </div>
      )}
    </div>
  )
}
