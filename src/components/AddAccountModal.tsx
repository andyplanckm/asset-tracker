import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { AccountIcon } from '../lib/icons'
import { errorMessage, supabase } from '../lib/supabase'
import { ICON_OPTIONS, type Account, type AccountType, type IconName } from '../lib/types'

interface Props {
  userId: string
  onClose: () => void
  onSaved: () => Promise<void>
  editAccount?: Account | null
}

const accountTypes: { value: AccountType; label: string; active: string }[] = [
  { value: 'asset', label: '资产', active: 'border-green-300 bg-green-50 text-green-600' },
  { value: 'investment', label: '投资', active: 'border-amber-300 bg-amber-50 text-amber-600' },
  { value: 'liability', label: '负债', active: 'border-red-300 bg-red-50 text-red-600' },
  { value: 'pnl', label: '投资盈亏', active: 'border-violet-300 bg-violet-50 text-violet-600' },
]

export default function AddAccountModal({ userId, onClose, onSaved, editAccount }: Props) {
  const [name, setName] = useState(editAccount?.name ?? '')
  const [type, setType] = useState<AccountType>(editAccount?.type ?? 'asset')
  const [icon, setIcon] = useState<IconName>((editAccount?.icon as IconName) ?? 'Wallet')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const result = editAccount
        ? await supabase.from('accounts').update({ name: name.trim(), type, icon }).eq('id', editAccount.id)
        : await supabase.from('accounts').insert({ user_id: userId, name: name.trim(), type, icon })
      if (result.error) throw result.error
      await onSaved()
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, '保存失败，请重试'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" role="presentation">
      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="account-dialog-title" className="text-lg font-semibold text-gray-800">{editAccount ? '编辑账户' : '添加账户'}</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="account-name" className="block text-sm font-medium text-gray-600 mb-1">名称</label>
            <input id="account-name" type="text" value={name} onChange={(event) => setName(event.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="如：支付宝、微信、美团月付" autoFocus />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-600 mb-1">类型</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {accountTypes.map((option) => (
                <button key={option.value} type="button" onClick={() => setType(option.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer ${type === option.value ? option.active : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-600 mb-2">图标</legend>
            <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto">
              {ICON_OPTIONS.map((option) => (
                <button key={option} type="button" onClick={() => setIcon(option)} aria-label={option}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition cursor-pointer ${icon === option ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  <AccountIcon name={option} />
                </button>
              ))}
            </div>
          </fieldset>

          {error && <p role="alert" className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition cursor-pointer disabled:cursor-not-allowed">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
