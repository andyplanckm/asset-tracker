export type AccountType = 'asset' | 'investment' | 'liability' | 'pnl'

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: AccountType
          icon: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: AccountType
          icon?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: AccountType
          icon?: string
          created_at?: string
        }
        Relationships: []
      }
      balances: {
        Row: {
          id: string
          account_id: string
          user_id: string
          amount: number
          recorded_on: string
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          user_id: string
          amount: number
          recorded_on: string
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          user_id?: string
          amount?: number
          recorded_on?: string
          recorded_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'balances_account_user_fk'
            columns: ['account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
