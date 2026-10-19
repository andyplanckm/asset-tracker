import { useSyncExternalStore } from 'react'
import { CheckCircle2, CloudOff, LoaderCircle, RefreshCw } from 'lucide-react'

function subscribeToNetwork(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const syncTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})

export default function SyncStatus({ lastSyncedAt, refreshing, error, onRefresh }: {
  lastSyncedAt: number | null
  refreshing: boolean
  error: string
  onRefresh: () => Promise<void>
}) {
  const online = useSyncExternalStore(subscribeToNetwork, () => navigator.onLine, () => true)
  const problem = !online || Boolean(error)
  const Icon = refreshing ? LoaderCircle : problem ? CloudOff : CheckCircle2

  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-xs ${problem ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200/80 bg-white/80 text-slate-600'}`}>
      <div className="flex min-w-0 items-start gap-2.5" role="status" aria-live="polite">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${refreshing ? 'animate-spin' : problem ? 'text-amber-700' : 'text-emerald-600'}`} aria-hidden="true" />
        <div className="leading-5">
          <p className="font-semibold">{!online ? '当前网络已断开' : refreshing ? '正在同步云端记录' : error ? '暂未同步到最新记录' : '已读取云端记录'}</p>
          <p className="text-[11px] opacity-80">
            {lastSyncedAt ? `上次成功同步 ${syncTimeFormatter.format(lastSyncedAt)}（中国时区）` : '等待首次同步'}
            {problem && lastSyncedAt ? ' · 当前保留上次成功读取的数据' : ''}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => void onRefresh()} disabled={refreshing || !online} className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        {refreshing ? '同步中' : '刷新数据'}
      </button>
    </div>
  )
}
