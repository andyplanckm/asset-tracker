import { useRef, useState, type ReactNode } from 'react'
import { CircleHelp, TriangleAlert } from 'lucide-react'
import Dialog from './Dialog'

export type ConfirmDialogTone = 'default' | 'warning' | 'danger'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
  closeOnConfirm?: boolean
}

const toneStyles: Record<ConfirmDialogTone, {
  icon: string
  button: string
}> = {
  default: {
    icon: 'bg-blue-50 text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-600',
    button: 'bg-amber-500 hover:bg-amber-600 focus-visible:outline-amber-500',
  },
  danger: {
    icon: 'bg-red-50 text-red-600',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600',
  },
}

function confirmationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请重试'
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'danger',
  closeOnConfirm = true,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const styles = toneStyles[tone]
  const Icon = tone === 'default' ? CircleHelp : TriangleAlert

  const handleClose = () => {
    if (pending) return
    setError('')
    onClose()
  }

  const handleConfirm = async () => {
    if (pending) return
    setPending(true)
    setError('')

    try {
      await onConfirm()
      if (closeOnConfirm) onClose()
    } catch (confirmError: unknown) {
      setError(confirmationErrorMessage(confirmError))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      size="sm"
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      showCloseButton={!pending}
      initialFocusRef={cancelButtonRef}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={pending}
            aria-busy={pending}
            className={`min-h-11 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-wait disabled:opacity-60 ${styles.button}`}
          >
            {pending ? '处理中…' : confirmLabel}
          </button>
        </div>
      )}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm leading-6 text-slate-600">
            请确认后再继续，此操作可能无法撤销。
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  )
}
