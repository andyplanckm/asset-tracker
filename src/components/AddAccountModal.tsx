import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ICON_OPTIONS } from '../lib/types'
import type { IconName } from '../lib/types'
import * as Icons from 'lucide-react'

interface Props {
  onClose: () => void
  onSaved: () => void
  editAccount?: { id: string; name: string; type: 'asset' | 'investment' | 'liability' | 'pnl'; icon: string } | null
}

export default function AddAccountModal({ onClose, onSaved, editAccount }: Props) {
  const [name, setName] = useState(editAccount?.name || '')
  const [type, setType] = useState<'asset' | 'investment' | 'liability' | 'pnl'>(editAccount?.type || 'asset')
  const [icon, setIcon] = useState<IconName>((editAccount?.icon as IconName) || 'Wallet')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (editAccount) {
        const { error: err } = await supabase
          .from('accounts')
          .update({ name: name.trim(), type, icon })
          .eq('id', editAccount.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('accounts')
          .insert({ user_id: user.id, name: name.trim(), type, icon })
        if (err) throw err
      }

      onSaved()
    } catch (err: any) {
      setError(err.message || '保存失败，请重试')
      setSaving(false)
    }
  }

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName]
    return IconComponent ? <IconComponent className="w-5 h-5" /> : null
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {editAccount ? '编辑账户' : '添加账户'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="如：支付宝、微信、美团月付"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('asset')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer ${
                  type === 'asset'
                    ? 'border-green-300 bg-green-50 text-green-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                资产
              </button>
              <button
                onClick={() => setType('investment')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer ${
                  type === 'investment'
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                投资
              </button>
              <button
                onClick={() => setType('liability')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer ${
                  type === 'liability'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                负债
              </button>
              <button
                onClick={() => setType('pnl')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer ${
                  type === 'pnl'
                    ? 'border-violet-300 bg-violet-50 text-violet-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                投资盈亏
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">图标</label>
            <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    icon === ic ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {renderIcon(ic)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition cursor-pointer"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
