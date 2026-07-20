-- 全新 Supabase 项目的初始化结构。
-- 已有项目请执行 supabase/migrations/202607200001_optimize_daily_balances.sql。

CREATE TABLE accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    type TEXT NOT NULL CHECK (type IN ('asset', 'investment', 'liability', 'pnl')),
    icon TEXT NOT NULL DEFAULT 'Wallet',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT accounts_id_user_id_key UNIQUE (id, user_id)
);

CREATE TABLE balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    recorded_on DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Shanghai')::date),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT balances_account_user_fk
        FOREIGN KEY (account_id, user_id)
        REFERENCES accounts(id, user_id)
        ON DELETE CASCADE,
    CONSTRAINT balances_account_recorded_on_key UNIQUE (account_id, recorded_on)
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_balances_user_recorded_on ON balances(user_id, recorded_on DESC);
CREATE INDEX idx_balances_account_recorded_at ON balances(account_id, recorded_at DESC);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own accounts"
    ON accounts FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own balances"
    ON balances FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
