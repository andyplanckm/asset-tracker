-- 新增"投资"账户类型的数据库迁移
-- 请在 Supabase 控制台的 SQL Editor 中执行

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (type IN ('asset', 'investment', 'liability'));
