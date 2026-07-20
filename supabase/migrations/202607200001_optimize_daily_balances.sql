BEGIN;

-- 统一账户类型约束。
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts
    ADD CONSTRAINT accounts_type_check
    CHECK (type IN ('asset', 'investment', 'liability', 'pnl'));

-- 以中国时区回填现有数据的业务日期，后续应用会显式写入该字段。
ALTER TABLE balances ADD COLUMN IF NOT EXISTS recorded_on DATE;

UPDATE balances
SET recorded_on = (recorded_at AT TIME ZONE 'Asia/Shanghai')::date
WHERE recorded_on IS NULL;

-- 旧逻辑可能在并发写入时生成同日重复记录，仅保留最后一条。
WITH ranked AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY account_id, recorded_on
            ORDER BY recorded_at DESC, created_at DESC, id DESC
        ) AS row_number
    FROM balances
)
DELETE FROM balances
WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);

ALTER TABLE balances
    ALTER COLUMN recorded_on SET NOT NULL,
    ALTER COLUMN recorded_on SET DEFAULT ((now() AT TIME ZONE 'Asia/Shanghai')::date);

CREATE UNIQUE INDEX IF NOT EXISTS balances_account_recorded_on_uidx
    ON balances(account_id, recorded_on);
CREATE INDEX IF NOT EXISTS idx_balances_user_recorded_on
    ON balances(user_id, recorded_on DESC);
CREATE INDEX IF NOT EXISTS idx_balances_account_recorded_at
    ON balances(account_id, recorded_at DESC);

-- 修复历史上的冗余 user_id 不一致，并通过复合外键永久保证账户归属。
UPDATE balances AS balance
SET user_id = account.user_id
FROM accounts AS account
WHERE balance.account_id = account.id
  AND balance.user_id <> account.user_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'accounts_id_user_id_key'
          AND conrelid = 'accounts'::regclass
    ) THEN
        ALTER TABLE accounts
            ADD CONSTRAINT accounts_id_user_id_key UNIQUE (id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'balances_account_user_fk'
          AND conrelid = 'balances'::regclass
    ) THEN
        ALTER TABLE balances
            ADD CONSTRAINT balances_account_user_fk
            FOREIGN KEY (account_id, user_id)
            REFERENCES accounts(id, user_id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE balances VALIDATE CONSTRAINT balances_account_user_fk;

DROP POLICY IF EXISTS "Users can manage their own accounts" ON accounts;
CREATE POLICY "Users can manage their own accounts"
    ON accounts FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own balances" ON balances;
CREATE POLICY "Users can manage their own balances"
    ON balances FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMIT;
