import { useMemo, useState } from 'react'
import { Calendar, Edit3, History, LayoutGrid, Plus, Table2, Trash2, TrendingUp } from 'lucide-react'
import AddAccountModal from './AddAccountModal'
import BalanceHistory from './BalanceHistory'
import BatchRecordModal from './BatchRecordModal'
import HistoryTable from './HistoryTable'
import RecordBalanceModal from './RecordBalanceModal'
import TrendChart from './TrendChart'
import { buildDailySnapshots, formatMoney } from '../lib/domain'
import { AccountIcon } from '../lib/icons'
import { errorMessage, supabase } from '../lib/supabase'
import type { Account, AccountType, AccountWithBalance, Balance } from '../lib/types'

interface Props {
  userId: string
  accounts: Account[]
  balances: Balance[]
  loading: boolean
  onDataChanged: () => Promise<void>
}

type ViewMode = 'cards' | 'table'

const sectionDefinitions: { type: AccountType; label: string; color: string }[] = [
  { type: 'asset', label: '资产账户', color: 'text-green-600' },
  { type: 'investment', label: '投资账户', color: 'text-amber-500' },
  { type: 'liability', label: '负债账户', color: 'text-red-500' },
  { type: 'pnl', label: '投资盈亏', color: 'text-violet-500' },
]

export default function AccountList({ userId, accounts, balances, loading, onDataChanged }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [recordAccount, setRecordAccount] = useState<Account | null>(null)
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null)
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [error, setError] = useState('')

  const snapshots = useMemo(() => buildDailySnapshots(accounts, balances), [accounts, balances])
  const latestValues = snapshots.at(-1)?.values
  const accountsWithBalances: AccountWithBalance[] = accounts.map((account) => ({
    ...account,
    latest_balance: latestValues?.get(account.id) ?? null,
  }))

  const handleDelete = async (account: Account) => {
    if (!confirm(`确定删除“${account.name}”吗？所有历史记录也会一并删除。`)) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('accounts').delete().eq('id', account.id)
      if (deleteError) throw deleteError
      await onDataChanged()
    } catch (deleteError: unknown) {
      setError(errorMessage(deleteError, '账户删除失败，请重试'))
    }
  }

  const toggleChart = (id: string) => {
    setExpandedCharts((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading && accounts.length === 0) {
    return <div className="text-center text-gray-400 py-12">加载中...</div>
  }

  return (
    <div>
      {error && <p role="alert" className="mb-4 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex self-start rounded-md overflow-hidden border border-gray-200 text-xs">
          <button type="button" onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 cursor-pointer transition flex items-center gap-1 ${viewMode === 'cards' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            <LayoutGrid className="w-3.5 h-3.5" /> 卡片
          </button>
          <button type="button" onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 cursor-pointer transition flex items-center gap-1 ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            <Table2 className="w-3.5 h-3.5" /> 表格
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setShowBatchModal(true)} disabled={accounts.length === 0}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 disabled:text-gray-300 font-medium cursor-pointer disabled:cursor-not-allowed">
            <Calendar className="w-4 h-4" /> 批量记录
          </button>
          <button type="button" onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium cursor-pointer">
            <Plus className="w-4 h-4" /> 添加账户
          </button>
        </div>
      </div>

      {viewMode === 'table' && (
        <HistoryTable userId={userId} accounts={accounts} balances={balances} onChanged={onDataChanged} />
      )}

      {viewMode === 'cards' && (
        accounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-lg mb-4">还没有账户，开始记录你的资产吧</p>
            <button type="button" onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition cursor-pointer">
              添加第一个账户
            </button>
          </div>
        ) : (
          sectionDefinitions.map((section) => {
            const sectionAccounts = accountsWithBalances.filter((account) => account.type === section.type)
            if (sectionAccounts.length === 0) return null
            return (
              <section key={section.type} className="mb-8">
                <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${section.color}`}>{section.label}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sectionAccounts.map((account) => (
                    <AccountCard key={account.id} account={account}
                      balances={balances.filter((balance) => balance.account_id === account.id)}
                      onRecord={() => setRecordAccount(account)} onEdit={() => setEditAccount(account)}
                      onDelete={() => void handleDelete(account)} onHistory={() => setHistoryAccount(account)}
                      onToggleChart={() => toggleChart(account.id)} showChart={expandedCharts.has(account.id)} />
                  ))}
                </div>
              </section>
            )
          })
        )
      )}

      {showAddModal && (
        <AddAccountModal userId={userId} onClose={() => setShowAddModal(false)}
          onSaved={async () => { setShowAddModal(false); await onDataChanged() }} />
      )}
      {editAccount && (
        <AddAccountModal userId={userId} editAccount={editAccount} onClose={() => setEditAccount(null)}
          onSaved={async () => { setEditAccount(null); await onDataChanged() }} />
      )}
      {recordAccount && (
        <RecordBalanceModal userId={userId} account={recordAccount} onClose={() => setRecordAccount(null)}
          onSaved={async () => { setRecordAccount(null); await onDataChanged() }} />
      )}
      {historyAccount && (
        <BalanceHistory accountName={historyAccount.name}
          balances={balances.filter((balance) => balance.account_id === historyAccount.id)}
          onClose={() => setHistoryAccount(null)} onChanged={onDataChanged} />
      )}
      {showBatchModal && (
        <BatchRecordModal userId={userId} accounts={accountsWithBalances} onClose={() => setShowBatchModal(false)}
          onSaved={async () => { setShowBatchModal(false); await onDataChanged() }} />
      )}
    </div>
  )
}

function AccountCard({
  account,
  balances,
  onRecord,
  onEdit,
  onDelete,
  onHistory,
  onToggleChart,
  showChart,
}: {
  account: AccountWithBalance
  balances: Balance[]
  onRecord: () => void
  onEdit: () => void
  onDelete: () => void
  onHistory: () => void
  onToggleChart: () => void
  showChart: boolean
}) {
  const colorMap: Record<AccountType, string> = { asset: 'text-green-600', investment: 'text-amber-500', liability: 'text-red-500', pnl: 'text-violet-500' }
  const backgroundMap: Record<AccountType, string> = { asset: 'bg-green-50', investment: 'bg-amber-50', liability: 'bg-red-50', pnl: 'bg-violet-50' }
  const colorClass = colorMap[account.type]

  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${backgroundMap[account.type]} ${colorClass} flex items-center justify-center shrink-0`}><AccountIcon name={account.icon} /></div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{account.name}</p>
              <p className="text-xs text-gray-400">{account.latest_balance === null ? '暂无记录' : '最新余额'}</p>
            </div>
          </div>
          <p className={`text-lg font-bold text-right ${colorClass}`}>{account.latest_balance === null ? '-' : `¥${formatMoney(account.latest_balance)}`}</p>
        </div>
        <div className="flex items-center gap-1 border-t border-gray-50 pt-3">
          <button type="button" onClick={onRecord} className="flex-1 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-50 rounded-md transition cursor-pointer">记一笔</button>
          <ActionButton label="历史" title="查看历史" onClick={onHistory}><History className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton label="趋势" title="趋势图" onClick={onToggleChart} active={showChart}><TrendingUp className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton title="编辑" onClick={onEdit}><Edit3 className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton title="删除" onClick={onDelete} danger><Trash2 className="w-3.5 h-3.5" /></ActionButton>
        </div>
      </div>
      {showChart && <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50"><TrendChart balances={balances} /></div>}
    </article>
  )
}

function ActionButton({ children, label, title, onClick, active = false, danger = false }: {
  children: React.ReactNode
  label?: string
  title: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  const idleClass = danger ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition cursor-pointer ${active ? 'text-blue-500 bg-blue-50' : idleClass}`}>
      {children}{label}
    </button>
  )
}
