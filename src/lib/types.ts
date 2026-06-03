export interface Account {
  id: string
  user_id: string
  name: string
  type: 'asset' | 'investment' | 'liability' | 'pnl'
  icon: string
  created_at: string
}

export interface Balance {
  id: string
  account_id: string
  user_id: string
  amount: number
  recorded_at: string
  created_at: string
}

export interface AccountWithBalance extends Account {
  latest_balance: number | null
  balances?: Balance[]
}

export const ICON_OPTIONS = [
  'Wallet', 'CreditCard', 'Landmark', 'PiggyBank', 'Coins',
  'TrendingUp', 'DollarSign', 'Banknote', 'CircleDollarSign',
  'ShoppingBag', 'ShoppingCart', 'Store', 'Briefcase',
  'Home', 'Car', 'GraduationCap', 'Heart', 'Star',
  'Smartphone', 'Globe', 'Zap', 'Gift', 'Coffee',
  'BarChart3', 'LineChart', 'CandlestickChart',
] as const

export type IconName = (typeof ICON_OPTIONS)[number]
