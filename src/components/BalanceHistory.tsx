import { useState } from 'react'
import { CalendarDays, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Balance } from '../lib/types'
import ConfirmDialog from './ui/ConfirmDialog'
import Dialog from './ui/Dialog'
import Money from './ui/Money'
import { useToast } from './ui/Toast'

interface Props {
  accountName: string
  balances: Balance[]
  onClose: () => void
  onChanged: () => Promise<void>
}

export default function BalanceHistory({
  accountName,
  balances,
  onClose,
  onChanged,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<Balance | null>(null)
  const { showToast } = useToast()
  const sortedBalances = [...balances].sort(
    (left, right) => right.recorded_on.localeCompare(left.recorded_on),
  )

  const handleDelete = async () => {
    if (!pendingDelete) return
    const { error: deleteError } = await supabase
      .from('balances')
      .delete()
      .eq('id', pendingDelete.id)
    if (deleteError) throw deleteError

    const deletedDate = pendingDelete.recorded_on
    setPendingDelete(null)
    await onChanged()
    showToast({
      variant: 'success',
      title: '记录已删除',
      message: `${accountName} · ${formatDisplayDate(deletedDate)}`,
    })
  }

  return (
    <>
      <Dialog
        open={!pendingDelete}
        onClose={onClose}
        title={`${accountName} 的历史`}
        description={`共 ${sortedBalances.length} 条实际记录`}
        size="md"
        contentClassName="py-4"
      >
        {sortedBalances.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <CalendarDays className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-slate-700">暂无历史记录</p>
          </div>
        ) : (
          <ol className="relative ml-2 border-l border-slate-200 pl-5">
            {sortedBalances.map((balance, index) => (
              <li key={balance.id} className="relative pb-4 last:pb-0">
                <span className={`absolute -left-[1.58rem] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-white ${index === 0 ? 'bg-blue-600' : 'bg-slate-300'}`} />
                <div className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div>
                    <Money value={balance.amount} className="font-bold text-slate-900" />
                    <p className="mt-1 text-xs text-slate-500">{formatDisplayDate(balance.recorded_on)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(balance)}
                    aria-label={`删除 ${balance.recorded_on} 的记录`}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="删除这条余额记录？"
        description={pendingDelete
          ? (
              <span className="flex flex-wrap items-center gap-1">
                <span>{formatDisplayDate(pendingDelete.recorded_on)} ·</span>
                <Money value={pendingDelete.amount} />
              </span>
            )
          : undefined}
        confirmLabel="确认删除"
        tone="danger"
      />
    </>
  )
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}
