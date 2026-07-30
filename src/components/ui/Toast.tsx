import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
  dismissAfterAction?: boolean
}

export interface ToastOptions {
  title?: ReactNode
  message: ReactNode
  variant?: ToastVariant
  duration?: number
  action?: ToastAction
}

export interface ToastContextValue {
  showToast: (options: ToastOptions | string) => string
  dismissToast: (id: string) => void
  clearToasts: () => void
}

export interface ToastProviderProps {
  children: ReactNode
  defaultDuration?: number
  maxToasts?: number
}

interface ToastItem extends ToastOptions {
  id: string
  variant: ToastVariant
  duration: number
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<ToastVariant, {
  container: string
  icon: string
  Icon: typeof CheckCircle2
}> = {
  success: {
    container: 'border-emerald-200',
    icon: 'bg-emerald-50 text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-red-200',
    icon: 'bg-red-50 text-red-600',
    Icon: CircleAlert,
  },
  warning: {
    container: 'border-amber-200',
    icon: 'bg-amber-50 text-amber-600',
    Icon: TriangleAlert,
  },
  info: {
    container: 'border-blue-200',
    icon: 'bg-blue-50 text-blue-600',
    Icon: Info,
  },
}

let toastSequence = 0

function createToastId(): string {
  toastSequence += 1
  return `toast-${Date.now()}-${toastSequence}`
}

export function ToastProvider({
  children,
  defaultDuration = 4500,
  maxToasts = 4,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef(new Map<string, number>())

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
    setToasts([])
  }, [])

  const showToast = useCallback((input: ToastOptions | string): string => {
    const options: ToastOptions = typeof input === 'string' ? { message: input } : input
    const id = createToastId()
    const duration = options.duration ?? defaultDuration
    const item: ToastItem = {
      ...options,
      id,
      duration,
      variant: options.variant ?? 'info',
    }

    setToasts((current) => [...current, item].slice(-Math.max(1, maxToasts)))

    if (duration > 0) {
      const timer = window.setTimeout(() => dismissToast(id), duration)
      timersRef.current.set(id, timer)
    }

    return id
  }, [defaultDuration, dismissToast, maxToasts])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const value: ToastContextValue = {
    showToast,
    dismissToast,
    clearToasts,
  }

  const portalTarget = typeof document === 'undefined' ? null : document.body

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalTarget && createPortal(
        <div
          className="pointer-events-none fixed inset-x-4 z-[80] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:w-full sm:max-w-sm"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          aria-label="通知"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>,
        portalTarget,
      )}
    </ToastContext.Provider>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: (id: string) => void
}) {
  const styles = variantStyles[toast.variant]
  const { Icon } = styles

  const handleAction = () => {
    toast.action?.onClick()
    if (toast.action?.dismissAfterAction !== false) {
      onDismiss(toast.id)
    }
  }

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : undefined}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white/95 p-3 shadow-xl shadow-slate-950/10 backdrop-blur-xl ${styles.container}`}
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        {toast.title && <p className="text-sm font-semibold text-slate-900">{toast.title}</p>}
        <div className={`${toast.title ? 'mt-0.5' : ''} text-sm leading-5 text-slate-600`}>
          {toast.message}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={handleAction}
            className="mt-2 cursor-pointer text-sm font-semibold text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="关闭通知"
        className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内使用')
  }
  return context
}
