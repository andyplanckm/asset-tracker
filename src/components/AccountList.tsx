import { lazy, Suspense, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  CircleDollarSign,
  Clock3,
  Edit3,
  History,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { localDateString, summarizeBalances, type DailySnapshot } from '../lib/domain'
import { AccountIcon } from '../lib/icons'
import { errorMessage, supabase } from '../lib/supabase'
import type { Account, AccountType, AccountWithBalance, Balance } from '../lib/types'
import ConfirmDialog from './ui/ConfirmDialog'
import Money from './ui/Money'
import { useToast } from './ui/Toast'

const AddAccountModal = lazy(() => import('./AddAccountModal'))
const BalanceHistory = lazy(() => import('./BalanceHistory'))
const BatchRecordModal = lazy(() => import('./BatchRecordModal'))
const HistoryTable = lazy(() => import('./HistoryTable'))
const RecordBalanceModal = lazy(() => import('./RecordBalanceModal'))
const TrendChart = lazy(() => import('./TrendChart'))

interface Props {
  userId: string
  accounts: Account[]
  balancesByAccount: ReadonlyMap<string, Balance[]>
  snapshots: DailySnapshot[]
  loading: boolean
  onDataChanged: () => Promise<void>
}

type ViewMode = 'accounts' | 'history'
type FilterType = 'all' | AccountType

const sectionDefinitions: {
  type: AccountType
  label: string
  color: string
  dot: string
  panel: string
}[] = [
  {
    type: 'asset',
    label: '灵活取用',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    panel: 'bg-emerald-50 text-emerald-700',
  },
  {
    type: 'investment',
    label: '投资资产',
    color: 'text-amber-700',
    dot: 'bg-amber-500',
    panel: 'bg-amber-50 text-amber-700',
  },
  {
    type: 'liability',
    label: '负债账户',
    color: 'text-rose-700',
    dot: 'bg-rose-500',
    panel: 'bg-rose-50 text-rose-700',
  },
  {
    type: 'pnl',
    label: '投资盈亏',
    color: 'text-violet-700',
    dot: 'bg-violet-500',
    panel: 'bg-violet-50 text-violet-700',
  },
]

export default function AccountList({
  userId,
  accounts,
  balancesByAccount,
  snapshots,
  loading,
  onDataChanged,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('accounts')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [query, setQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [recordAccount, setRecordAccount] = useState<Account | null>(null)
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null)
  const [expandedCharts, setExpandedCharts] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
  const { showToast } = useToast()

  const latestValues = snapshots.at(-1)?.values
  const accountsWithBalances: AccountWithBalance[] = useMemo(
    () => accounts.map((account) => ({
      ...account,
      latest_balance: latestValues?.get(account.id) ?? null,
    })),
    [accounts, latestValues],
  )

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
    return accountsWithBalances.filter((account) => (
      (filterType === 'all' || account.type === filterType)
      && (!normalizedQuery || account.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
    ))
  }, [accountsWithBalances, filterType, query])

  const handleDelete = async () => {
    if (!pendingDelete) return
    const deletingAccount = pendingDelete
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', deletingAccount.id)
    if (deleteError) throw new Error(errorMessage(deleteError, '账户删除失败，请重试'))

    setPendingDelete(null)
    await onDataChanged()
    showToast({
      variant: 'success',
      title: '账户已删除',
      message: `${deletingAccount.name} 及其历史记录已移除`,
    })
  }

  const toggleChart = (id: string) => {
    setExpandedCharts((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading && accounts.length === 0) return <AccountListSkeleton />

  return (
    <section className="min-w-0" aria-labelledby="accounts-title">
      <div className="mb-5 rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-blue-600">账户与记录</p>
            <h2 id="accounts-title" className="text-lg font-bold tracking-tight text-slate-950">
              管理每一处资产来源
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {accounts.length} 个账户 · {snapshots.length} 个记录日
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <div className="col-span-2 flex min-w-0 rounded-xl bg-slate-100 p-1 text-xs sm:col-auto sm:mr-auto lg:mr-1" role="group" aria-label="内容视图">
              <ViewButton
                active={viewMode === 'accounts'}
                onClick={() => setViewMode('accounts')}
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
              >
                账户
              </ViewButton>
              <ViewButton
                active={viewMode === 'history'}
                onClick={() => setViewMode('history')}
                icon={<Table2 className="h-3.5 w-3.5" />}
              >
                历史台账
              </ViewButton>
            </div>
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              disabled={accounts.length === 0}
              className="flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              更新余额
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              添加账户
            </button>
          </div>
        </div>

        {viewMode === 'accounts' && accounts.length > 0 && (
          <div className="mt-5 flex min-w-0 flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-1 lg:w-auto" role="group" aria-label="账户类型筛选">
              <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')}>
                全部 <span className="text-[11px] opacity-70">{accounts.length}</span>
              </FilterButton>
              {sectionDefinitions.map((section) => {
                const count = accounts.filter((account) => account.type === section.type).length
                if (count === 0) return null
                return (
                  <FilterButton
                    key={section.type}
                    active={filterType === section.type}
                    onClick={() => setFilterType(section.type)}
                  >
                    {section.label} <span className="text-[11px] opacity-70">{count}</span>
                  </FilterButton>
                )
              })}
            </div>

            <label className="relative block w-full lg:w-64">
              <span className="sr-only">搜索账户</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索账户"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="清除搜索"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          </div>
        )}
      </div>

      {viewMode === 'history' && (
        <Suspense fallback={<PanelSkeleton />}>
          <HistoryTable
            userId={userId}
            accounts={accounts}
            snapshots={snapshots}
            onChanged={onDataChanged}
          />
        </Suspense>
      )}

      {viewMode === 'accounts' && (
        accounts.length === 0 ? (
          <EmptyAccounts onAdd={() => setShowAddModal(true)} />
        ) : visibleAccounts.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center">
            <Search className="mx-auto mb-3 h-7 w-7 text-slate-300" aria-hidden="true" />
            <h3 className="font-semibold text-slate-800">没有符合条件的账户</h3>
            <p className="mt-1 text-sm text-slate-500">换个关键词，或清除当前筛选</p>
            <button
              type="button"
              onClick={() => { setQuery(''); setFilterType('all') }}
              className="mt-4 cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              清除筛选
            </button>
          </div>
        ) : (
          sectionDefinitions.map((section) => {
            const sectionAccounts = visibleAccounts
              .filter((account) => account.type === section.type)
              .sort((left, right) => (right.latest_balance ?? -Infinity) - (left.latest_balance ?? -Infinity))
            if (sectionAccounts.length === 0) return null
            const sectionTotal = sectionAccounts.reduce((sum, account) => sum + (account.latest_balance ?? 0), 0)

            return (
              <section key={section.type} className="mb-7" aria-labelledby={`section-${section.type}`}>
                <div className="mb-3 flex items-center justify-between gap-4 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${section.dot}`} aria-hidden="true" />
                    <h3 id={`section-${section.type}`} className={`text-sm font-semibold ${section.color}`}>
                      {section.label}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {sectionAccounts.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    小计 <Money value={sectionTotal} className="ml-1 font-semibold text-slate-700" />
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {sectionAccounts.map((account) => {
                    const accountBalances = balancesByAccount.get(account.id) ?? []
                    return (
                      <AccountCard
                        key={account.id}
                        account={account}
                        balances={accountBalances}
                        onRecord={() => setRecordAccount(account)}
                        onEdit={() => setEditAccount(account)}
                        onDelete={() => setPendingDelete(account)}
                        onHistory={() => setHistoryAccount(account)}
                        onToggleChart={() => toggleChart(account.id)}
                        showChart={expandedCharts.has(account.id)}
                        panelClass={section.panel}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })
        )
      )}

      <Suspense fallback={null}>
        {showAddModal && (
          <AddAccountModal
            userId={userId}
            onClose={() => setShowAddModal(false)}
            onSaved={async () => {
              setShowAddModal(false)
              await onDataChanged()
              showToast({ variant: 'success', title: '账户已添加', message: '现在可以记录余额了' })
            }}
          />
        )}
        {editAccount && (
          <AddAccountModal
            userId={userId}
            editAccount={editAccount}
            hasHistory={(balancesByAccount.get(editAccount.id)?.length ?? 0) > 0}
            onClose={() => setEditAccount(null)}
            onSaved={async () => {
              setEditAccount(null)
              await onDataChanged()
              showToast({ variant: 'success', title: '账户已更新', message: '修改已保存' })
            }}
          />
        )}
        {recordAccount && (
          <RecordBalanceModal
            userId={userId}
            account={recordAccount}
            balances={balancesByAccount.get(recordAccount.id) ?? []}
            onClose={() => setRecordAccount(null)}
            onSaved={async () => {
              setRecordAccount(null)
              await onDataChanged()
              showToast({ variant: 'success', title: '余额已保存', message: '资产概览已同步更新' })
            }}
          />
        )}
        {historyAccount && (
          <BalanceHistory
            accountName={historyAccount.name}
            balances={balancesByAccount.get(historyAccount.id) ?? []}
            onClose={() => setHistoryAccount(null)}
            onChanged={onDataChanged}
          />
        )}
        {showBatchModal && (
          <BatchRecordModal
            userId={userId}
            accounts={accountsWithBalances}
            onClose={() => setShowBatchModal(false)}
            onSaved={async () => {
              setShowBatchModal(false)
              await onDataChanged()
              showToast({ variant: 'success', title: '余额已批量更新', message: '资产概览已同步更新' })
            }}
          />
        )}
      </Suspense>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={`删除“${pendingDelete?.name ?? ''}”？`}
        description="该账户及其所有历史余额记录都会被永久删除，资产趋势也会随之重新计算。"
        confirmLabel="永久删除"
        tone="danger"
      />
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
  panelClass,
}: {
  account: AccountWithBalance
  balances: Balance[]
  onRecord: () => void
  onEdit: () => void
  onDelete: () => void
  onHistory: () => void
  onToggleChart: () => void
  showChart: boolean
  panelClass: string
}) {
  const summary = summarizeBalances(balances)
  const updatedToday = summary.current?.recorded_on === localDateString()
  const change = summary.change
  const changeIsFavorable = change
    ? account.type === 'liability' ? change.amount <= 0 : change.amount >= 0
    : true
  const ChangeIcon = change && change.amount < 0 ? ArrowDownRight : ArrowUpRight

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-md">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${panelClass}`}>
              <AccountIcon name={account.icon} />
            </span>
            <div className="min-w-0">
              <h4 className="truncate font-semibold text-slate-900">{account.name}</h4>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                {updatedToday ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                    今日已更新
                  </>
                ) : summary.current ? (
                  <>
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    {formatShortDate(summary.current.recorded_on)} 更新
                  </>
                ) : '等待首次记录'}
              </p>
            </div>
          </div>

          <details className="relative">
            <summary
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
              aria-label={`${account.name} 更多操作`}
            >
              <MoreHorizontal className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl shadow-slate-200/60">
              <MenuButton icon={<History />} onClick={onHistory}>历史记录</MenuButton>
              <MenuButton icon={<Edit3 />} onClick={onEdit}>编辑账户</MenuButton>
              <MenuButton icon={<Trash2 />} onClick={onDelete} danger>
                删除账户
              </MenuButton>
            </div>
          </details>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">当前余额</p>
            {account.latest_balance === null ? (
              <p className="mt-1 text-xl font-bold text-slate-300">—</p>
            ) : (
              <Money
                value={account.latest_balance}
                className="mt-1 block overflow-hidden text-ellipsis text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
              />
            )}
          </div>
          {change && (
            <div className={`shrink-0 text-right ${changeIsFavorable ? 'text-emerald-700' : 'text-rose-700'}`}>
              <p className="flex items-center justify-end gap-1 text-xs font-semibold">
                <ChangeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <Money value={change.amount} signed />
              </p>
              <p className="mt-1 text-xs text-slate-500">较上次记录</p>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onRecord}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-blue-50 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            更新余额
          </button>
          <button
            type="button"
            onClick={onToggleChart}
            aria-expanded={showChart}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${
              showChart ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {showChart ? '收起趋势' : '查看趋势'}
          </button>
        </div>
      </div>

      {showChart && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4">
          <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-slate-100" />}>
            <TrendChart balances={balances} />
          </Suspense>
        </div>
      )}
    </article>
  )
}

function MenuButton({
  children,
  icon,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode
  icon: React.ReactElement<{ className?: string }>
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left transition disabled:cursor-wait disabled:opacity-50 ${
        danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {children}
    </button>
  )
}

function ViewButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 font-medium transition ${
        active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {icon}{children}
    </button>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 shrink-0 cursor-pointer rounded-xl px-3 text-xs font-semibold transition ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyAccounts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white/80 px-5 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <CircleDollarSign className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="font-semibold text-slate-900">从第一个账户开始</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        添加现金、投资或负债账户，更新余额后即可追踪净资产变化。
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        添加账户
      </button>
    </div>
  )
}

function AccountListSkeleton() {
  return (
    <div className="space-y-4" aria-label="账户加载中" aria-busy="true">
      <div className="h-36 animate-pulse rounded-[1.25rem] bg-white" />
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-52 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  )
}

function PanelSkeleton() {
  return <div className="h-80 animate-pulse rounded-[1.25rem] bg-white" aria-label="内容加载中" />
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日`
}
