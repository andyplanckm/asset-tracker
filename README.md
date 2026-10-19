# 资产总览

基于 React、TypeScript、Vite 和 Supabase 的个人资产快照应用。支持资产、投资、负债和投资盈亏账户，以及每日记录、待确认账户快捷更新、期间变化洞察、数据新鲜度提醒、历史台账与 CSV 导出。

## 日常使用

- 账户列表支持类型、余额状态和名称组合筛选，以及余额、名称、最久未确认排序。筛选只影响下方列表，顶部净资产始终使用全部账户。
- 卡片和紧凑布局可切换；仅布局及分组展开偏好保存在浏览器，不缓存资产金额。
- 账户分组按灵活取用、负债、投资、投资盈亏排列，投资两组默认收起，可点击分组标题展开；浏览器按用户记住收起状态。搜索或筛选时临时展开结果，退出筛选后恢复偏好。收起只影响显示，分组金额仍计入原有汇总，批量录入仍按弹窗内实际填写的账户保存。
- 批量录入按所选日期带入该日或之前的余额。“填入空白项”保留已输入金额；切换日期需确认清空草稿；替换同日记录前需勾选覆盖确认。
- 批量窗口会预览本窗口账户的净资产变化；负债扣除，投资盈亏不重复计入，首次纳入账户单独说明。余额变化不等于投资收益。
- 页面上方显示上次成功同步时间。刷新失败会保留本次页面已读数据；HTTP 和整次资产刷新有 20 秒截止，登录初始化有 15 秒提示。页面刷新后仍需要从云端读取，不支持离线写入。
- 隐私模式下导出 CSV 前会再次确认，因为下载文件包含真实金额。

交互参考：[Wealthfolio 账户管理](https://wealthfolio.app/docs/guide/accounts/)、[WorthBase](https://github.com/callmebg/worthbase)、[Actual 同步与数据安全](https://actualbudget.org/docs/getting-started/sync/)。借鉴使用流程，保留本项目的余额快照模型与 Supabase 架构。

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
