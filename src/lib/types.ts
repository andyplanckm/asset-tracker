import type { AccountType, Database } from './database.types'

export type { AccountType }

export type Account = Database['public']['Tables']['accounts']['Row']

export type Balance = Database['public']['Tables']['balances']['Row']

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
