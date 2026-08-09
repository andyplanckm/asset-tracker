# 资产总览

基于 React、TypeScript、Vite 和 Supabase 的个人资产快照应用。支持资产、投资、负债和投资盈亏账户，以及每日记录、待确认账户快捷更新、期间变化洞察、数据新鲜度提醒、历史台账与 CSV 导出。

## 本地开发

要求 Node.js 20.19+ 或 22.12+。

```bash
npm ci
cp .env.example .env
npm run dev
```

在 `.env` 中配置：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase

全新项目可以在 SQL Editor 中执行 [`schema.sql`](./schema.sql)。已有数据库必须按顺序应用 [`supabase/migrations`](./supabase/migrations) 中尚未执行的迁移，再部署新版前端。其中 [`202607300001_lock_account_type_with_history.sql`](./supabase/migrations/202607300001_lock_account_type_with_history.sql) 会锁定已有余额历史的账户类型；[`202608090001_prevent_future_balance_dates.sql`](./supabase/migrations/202608090001_prevent_future_balance_dates.sql) 会禁止写入晚于中国时区当天的余额记录，并优化 RLS 用户校验。

如果当前仓库尚未连接 Supabase CLI，最直接的方式是把迁移文件全文复制到 Supabase SQL Editor 执行。迁移必须先成功提交，再合并并部署前端。

迁移会：

- 增加稳定的 `recorded_on` 业务日期；
- 在非公开的 `migration_backups` schema 中保留迁移前账户和余额快照；
- 合并同一账户同一天的重复记录；
- 增加 `(account_id, recorded_on)` 唯一约束以支持原子 upsert；
- 增加查询索引和账户/用户一致性外键；
- 收紧 RLS 策略到已认证用户，并让 `auth.uid()` 在每条语句中只计算一次；
- 阻止修改已有历史记录账户的类型，避免旧数据被重新解释；
- 阻止未来日期余额影响当前净资产和趋势。

建议先在 Supabase 控制台创建数据库备份。迁移必须早于前端部署，否则新版查询会因为缺少 `recorded_on` 而失败。

## 校验与部署

```bash
npm run lint
npm run test
npm run build
```

Vite 会在生产构建前校验两个 `VITE_SUPABASE_*` 环境变量；缺少配置或 URL 格式错误会直接失败。CI 只使用无权限的占位值验证生产包结构，Vercel 必须配置真实的项目 URL 和客户端公开密钥。仓库根目录的 `vercel.json` 使用 `npm ci` 构建，并配置了 SPA 回退和基础安全响应头。
