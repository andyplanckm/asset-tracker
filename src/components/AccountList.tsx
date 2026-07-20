import { useMemo, useState } from 'react'
import { Calendar, CircleDollarSign, Edit3, History, LayoutGrid, Plus, Table2, Trash2, TrendingUp } from 'lucide-react'
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

const sectionDefinitions: { type: AccountType; label: string; color: string; dot: string }[] = [
  { type: 'asset', label: '资产账户', color: 'text-emerald-700', dot: 'bg-emerald-500' },
  { type: 'investment', label: '投资账户', color: 'text-amber-700', dot: 'bg-amber-500' },
  { type: 'liability', label: '负债账户', color: 'text-rose-700', dot: 'bg-rose-500' },
  { type: 'pnl', label: '投资盈亏', color: 'text-violet-700', dot: 'bg-violet-500' },
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
    return (
      <div className="space-y-4" aria-label="账户加载中">
        <div className="h-16 animate-pulse rounded-2xl bg-white/70" />
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-white/70" />)}
        </div>
      </div>
    )
  }

  return (
    <section>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm shadow-slate-200/40 ring-1 ring-slate-100/70 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="font-semibold text-slate-900">账户明细</h2>
          <p className="mt-1 text-xs text-slate-400">共 {accounts.length} 个账户，可随时记录和回看</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex rounded-xl bg-slate-100 p-1 text-xs sm:mr-1">
            <button type="button" onClick={() => setViewMode('cards')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /> 卡片
            </button>
            <button type="button" onClick={() => setViewMode('table')}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" /> 表格
            </button>
          </div>
          <button type="button" onClick={() => setShowBatchModal(true)} disabled={accounts.length === 0}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-slate-300">
            <Calendar className="h-4 w-4" aria-hidden="true" /> 批量记录
          </button>
          <button type="button" onClick={() => setShowAddModal(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700">
            <Plus className="h-4 w-4" aria-hidden="true" /> 添加账户
          </button>
        </div>
      </div>

      {viewMode === 'table' && (
        <HistoryTable userId={userId} accounts={accounts} balances={balances} onChanged={onDataChanged} />
      )}

      {viewMode === 'cards' && (
        accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
              <CircleDollarSign className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-slate-800">开始建立你的资产视图</h3>
            <p className="mb-5 mt-1 text-sm text-slate-400">添加第一个账户，后续变化会自动汇总到这里</p>
            <button type="button" onClick={() => setShowAddModal(true)}
              className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700">
              添加第一个账户
            </button>
          </div>
        ) : (
          sectionDefinitions.map((section) => {
            const sectionAccounts = accountsWithBalances.filter((account) => account.type === section.type)
            if (sectionAccounts.length === 0) return null
            return (
              <section key={section.type} className="mb-7">
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${section.dot}`} />
                  <h3 className={`text-sm font-semibold ${section.color}`}>{section.label}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">{sectionAccounts.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
    </section>
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
  const colorMap: Record<AccountType, string> = { asset: 'text-emerald-600', investment: 'text-amber-600', liability: 'text-rose-600', pnl: 'text-violet-600' }
  const backgroundMap: Record<AccountType, string> = { asset: 'bg-emerald-50', investment: 'bg-amber-50', liability: 'bg-rose-50', pnl: 'bg-violet-50' }
  const colorClass = colorMap[account.type]

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/90 bg-white/90 shadow-sm shadow-slate-200/50 ring-1 ring-slate-100/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${backgroundMap[account.type]} ${colorClass} ring-1 ring-black/[0.03] transition group-hover:scale-105`}><AccountIcon name={account.icon} /></div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">{account.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{account.latest_balance === null ? '暂无记录' : '最新余额'}</p>
            </div>
          </div>
          <p className={`break-all text-right text-lg font-bold tracking-tight sm:text-xl ${colorClass}`}>{account.latest_balance === null ? '—' : `¥${formatMoney(account.latest_balance)}`}</p>
        </div>
        <div className="flex items-center gap-1 border-t border-slate-100 pt-3">
          <button type="button" onClick={onRecord} className="mr-1 flex flex-1 cursor-pointer items-center justify-center rounded-lg bg-blue-50 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-100">记一笔</button>
          <ActionButton label="历史" title="查看历史" onClick={onHistory}><History className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton label="趋势" title="趋势图" onClick={onToggleChart} active={showChart}><TrendingUp className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton title="编辑" onClick={onEdit}><Edit3 className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton title="删除" onClick={onDelete} danger><Trash2 className="w-3.5 h-3.5" /></ActionButton>
        </div>
      </div>
      {showChart && <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4"><TrendChart balances={balances} /></div>}
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
  const idleClass = danger ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-2 text-xs transition ${active ? 'bg-blue-50 text-blue-600' : idleClass}`}>
      {children}{label && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}
