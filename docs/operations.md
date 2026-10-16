# 部署与运营交接

## 资源与归属

- 公开源码：`drdavid-kor/mc4need`。
- Worker：`mc4need`；数据库：`mc4need-db`；域名：`mc4need.david-widgets.com`。
- 均使用项目所有者现有 GitHub / Cloudflare 账号。根域网站与其他项目保持独立。
- 部署配置 `wrangler.jsonc` 中 account_id/database_id 是资源标识，不是认证凭证。自托管请替换为自己的账号、数据库与域名。
- APP_SECRET 为本项目单独生成的加密密钥，保留在忽略目录 `.private/` 并作为 Worker secret 上传。**不能随意替换**，否则既有私密配送信息无法解密。

## 部署与更新

```sh
npm ci
npm run typecheck
npm test
npm run bundle
npm run build
npx wrangler whoami
npx wrangler d1 migrations apply mc4need-db --remote
npx wrangler deploy
```

首次自托管创建 D1 并替换 ID；`npx wrangler secret put APP_SECRET` 写入独立随机密钥。应用不需要麦当劳 Token。真实数据迁移前先备份，迁移不要随意重写已应用 SQL。CLI/Skill 更新先递增 package.json、CLI、健康接口与安装脚本版本，再打包、核对版本专属 SHA256SUMS 并发布相同文件。已公开的预发布包也不得静默替换；保留旧包与旧校验文件。

当前 `PAYMENT_WINDOW_SECONDS=600`、`QUOTE_LOCK_SECONDS=300` 是可调整实现参数，需结合真实官方订单验证；本地超时不解除已创建/不明订单的占用。

## 管理入口

本地 `.private/admin-identity.json` 保存管理员平台凭证，未进入 Git。运行 `node scripts/admin-link.mjs` 得到只给本人使用的 5 分钟一次性链接；登录后进入 `/admin`。

管理员可查看举报、异常赞助与操作日志，隐藏/恢复公开内容及演示案例。普通用户无需管理员批准发布。不要将管理员 identity.json 或登录链接放入公开 Issue。管理员身份丢失时，可由数据库所有者创建新的平台访客，再通过 D1 将该 user ID 的 admin 设为 1；不要向任意已有用户授予权限。

平台不强行解锁存在未知官方订单的需求。运营应联系赞助人查询本人订单，核实取消或失效后同步，防止重复配送。创建结果不明且完全无证据时保留占用并关闭对外支持，不能把“查不到”冒充“没有订单”。

## 邮件

当前生产邮件未启用：Cloudflare Email Sending 管理 API 返回 Unauthorized 2036，尚无本项目发送凭证。UI 清楚提示使用站内通知。

代码包含可选 Resend 适配。若启用，配置独立 `RESEND_API_KEY` secret 与经验证域名的 `MAIL_FROM`，先在获准测试邮箱完成验证、恢复、通知与退订测试后再对外宣称邮件可用。不要复用其他项目未授权的密钥。邮件 API 成功不等于用户已读，失败会标记在通知 email_status 中。

## 备份与恢复

```sh
sh scripts/backup.sh
```

数据库导出放 `.private/backups/`，按隐私数据保存。**数据库与 APP_SECRET 两者都要保留**；只有 SQL 没有密钥，无法恢复私密配送字段。备份不上传公开仓库。

恢复时先建隔离测试 D1，导入 SQL，使用原密钥验证解密、记录数量、权限和前端。验证无误后才制定生产切换；不可直接对生产运行重建/清库命令。上线记录应说明恢复测试的具体范围，SQLite SQL 可导入不等于线上完整恢复演练。

## 回滚与监测

`npx wrangler deployments list` / `npx wrangler rollback <VERSION_ID>` 回滚 Worker 代码；数据库迁移需另外评估兼容性，不随代码自动回滚。回滚前确认安装包版本匹配。

检查 `/api/health`、HTTPS 首页、真实/示例分离、未决订单队列和 Cloudflare 错误率。日志仅记录错误类别，不记录 bearer token、完整登录 URL、麦当劳响应、收货电话或聊天正文。站内通知非实时推送；未启用任何额外营销发送或第三方分析。

## 费用与责任

Workers、D1、域名及可能邮件服务由项目所有者的 Cloudflare/邮件账号承担，按各自当前套餐计费，本项目不收款也不垫付餐费。不承诺永久免费或固定费用。正式引流前查看 Cloudflare 使用量和预算提示。真实餐费与退款由赞助人本人和官方订单处理。

项目所有者负责真实案例授权、举报处理与运营联系；README/网站不得把模拟案例写成真实履约。对外发帖、参赛 Issue 和真实支付是分别执行的步骤，不以创建文件代替。
