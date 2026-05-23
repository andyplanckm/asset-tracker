-- Supabase 数据库建表 SQL
-- 在 Supabase 控制台的 SQL Editor 中执行此文件

-- 1. 账户表
CREATE TABLE accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'investment', 'liability')),
    icon TEXT NOT NULL DEFAULT 'Wallet',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 余额记录表
CREATE TABLE balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 索引
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_balances_account_id ON balances(account_id);
CREATE INDEX idx_balances_user_id ON balances(user_id);
CREATE INDEX idx_balances_recorded_at ON balances(recorded_at DESC);

-- 4. RLS 策略 - 用户只能访问自己的数据
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own accounts"
    ON accounts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own balances"
    ON balances FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
