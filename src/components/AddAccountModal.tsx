import { useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { AccountIcon } from '../lib/icons'
import { errorMessage, supabase } from '../lib/supabase'
import { ICON_OPTIONS, type Account, type AccountType, type IconName } from '../lib/types'
import Dialog from './ui/Dialog'

interface Props {
  userId: string
  onClose: () => void
  onSaved: () => Promise<void>
  editAccount?: Account | null
  hasHistory?: boolean
}

const accountTypes: {
  value: AccountType
  label: string
  description: string
  active: string
}[] = [
  {
    value: 'asset',
    label: '灵活取用',
    description: '现金、活期等',
    active: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  {
    value: 'investment',
    label: '投资资产',
    description: '股票、基金等',
    active: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  {
    value: 'liability',
    label: '负债',
    description: '信用卡、借款等',
    active: 'border-rose-300 bg-rose-50 text-rose-700',
  },
  {
    value: 'pnl',
    label: '投资盈亏',
    description: '单独记录收益',
    active: 'border-violet-300 bg-violet-50 text-violet-700',
  },
]

export default function AddAccountModal({
  userId,
  onClose,
  onSaved,
  editAccount,
  hasHistory = false,
}: Props) {
  const [name, setName] = useState(editAccount?.name ?? '')
  const [type, setType] = useState<AccountType>(editAccount?.type ?? 'asset')
  const [icon, setIcon] = useState<IconName>((editAccount?.icon as IconName) ?? 'Wallet')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const typeLocked = Boolean(editAccount && hasHistory)

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const result = editAccount
        ? await supabase
          .from('accounts')
          .update({ name: name.trim(), type: typeLocked ? editAccount.type : type, icon })
          .eq('id', editAccount.id)
        : await supabase
          .from('accounts')
          .insert({ user_id: userId, name: name.trim(), type, icon })
      if (result.error) throw result.error
      await onSaved()
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, '保存失败，请重试'))
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editAccount ? '编辑账户' : '添加账户'}
      description={editAccount ? '调整账户名称和图标。' : '添加后即可开始记录余额和追踪变化。'}
      size="md"
      showCloseButton={!saving}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            form="account-form"
            disabled={saving || !name.trim()}
            className="min-h-11 cursor-pointer rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {saving ? '保存中…' : editAccount ? '保存修改' : '添加账户'}
          </button>
        </div>
      )}
    >
      <form id="account-form" onSubmit={handleSave} className="space-y-5">
        <div>
          <label htmlFor="account-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
            账户名称
          </label>
          <input
            id="account-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="例如：支付宝、工资卡、基金账户"
            autoComplete="off"
            autoFocus
          />
        </div>

        <fieldset disabled={typeLocked}>
          <legend className="mb-2 block text-sm font-semibold text-slate-700">账户类型</legend>
          <div className="grid grid-cols-2 gap-2">
            {accountTypes.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={type === option.value}
                onClick={() => setType(option.value)}
                className={`min-h-16 cursor-pointer rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  type === option.value
                    ? option.active
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs opacity-70">{option.description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {typeLocked && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>该账户已有历史记录，类型已锁定，避免改变过去的资产计算结果。</p>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 block text-sm font-semibold text-slate-700">账户图标</legend>
          <div className="grid max-h-44 grid-cols-6 gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2 sm:grid-cols-7">
            {ICON_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setIcon(option)}
                aria-label={`选择 ${option} 图标`}
                aria-pressed={icon === option}
                className={`flex aspect-square min-h-10 cursor-pointer items-center justify-center rounded-xl transition ${
                  icon === option
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <AccountIcon name={option} />
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}
