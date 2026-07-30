import { formatCompactMoney, formatMoney, formatSignedMoney } from '../../lib/domain'
import { usePrivacyMode } from '../../contexts/PrivacyContext'

interface Props {
  value: number
  signed?: boolean
  compact?: boolean
  className?: string
}

export default function Money({ value, signed = false, compact = false, className = '' }: Props) {
  const { amountsHidden } = usePrivacyMode()
  const visibleValue = compact
    ? formatCompactMoney(value)
    : signed
      ? formatSignedMoney(value)
      : `¥${formatMoney(value)}`

  return (
    <span
      className={`whitespace-nowrap tabular-nums ${className}`}
      aria-label={amountsHidden ? '金额已隐藏' : visibleValue}
    >
      {amountsHidden ? '¥••••••' : visibleValue}
    </span>
  )
}
