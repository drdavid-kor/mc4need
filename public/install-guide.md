# Mc4Need 安装 / Installation

Mc4Need CLI + Skill 协作使用你的 AI 客户端中已连接的麦当劳 MCP。CLI 只请求平台 API，平台不接收麦当劳 Token。

## macOS / Linux

在具备终端执行能力的 AI 客户端中，选择对应客户端：

```sh
curl -fsSL https://mc4need.david-widgets.com/install.sh -o /tmp/mc4need-install.sh
sh /tmp/mc4need-install.sh codex
# Claude Code: sh /tmp/mc4need-install.sh claude
~/.local/bin/mc4need doctor
```

可先查看脚本再执行。安装程序检查 Node.js 22+；没有合适版本时从 nodejs.org 下载到 Mc4Need 自有目录并核对官方 SHA-256。不需要 sudo，不修改其他软件的 Node。Mc4Need 发布包也验证 SHA-256。

## Windows PowerShell

提供安装脚本，**Windows 实机尚未验证**：

```powershell
Invoke-WebRequest https://mc4need.david-widgets.com/install.ps1 -OutFile "$env:TEMP\mc4need-install.ps1"
& "$env:TEMP\mc4need-install.ps1" -Client codex
& "$env:LOCALAPPDATA\Mc4Need\bin\mc4need.cmd" doctor
```

如果系统执行策略阻止脚本，请按你所在环境的政策运行，不自动降低全局执行策略。Claude Code 用 `-Client claude`。

## 技能加载与连接

- Codex: `~/.codex/skills/mc4need/SKILL.md`。
- Claude Code: `~/.claude/skills/mc4need/SKILL.md`。
- 当前聊天未自动发现时，明确读取该文件或重载客户端。安装文件成功不等于自动加载成功。
- 已有麦当劳 MCP 连接就复用。缺少连接时，在客户端设置中按 [官方指南](https://github.com/M-China/mcd-mcp-server) 配置并激活；不要把 Token 粘贴进聊天或 Mc4Need 网页。
- WorkBuddy 暂未做客户端自动发现实测，不能声称完成专项交付。普通无终端/Skill/MCP 能力的网页聊天不能执行此流程。

## 首次使用

```sh
~/.local/bin/mc4need auth guest
~/.local/bin/mc4need needs list
~/.local/bin/mc4need auth browser
```

`auth guest` 在本机建立可重复使用的平台身份，无需邮箱。`auth browser` 给出 5 分钟一次性链接，打开后看本人的记录。请勿转发或公开链接。CLI token 保存在 `~/.mc4need/identity.json`，不要输出到 AI 对话或提交 Git。

当前版本、测试范围和已知限制见 [公开仓库](https://github.com/drdavid-kor/mc4need)。`doctor` 只验证 CLI 与平台，不验证 MCP 连接、配送、支付或收餐。

## 升级 / 备份 / 卸载

重新运行安装脚本即可升级程序；身份文件与程序分离，不覆盖已有身份。可用 `mc4need identity export-file /absolute/private/backup.json` 备份，文件含私密平台凭证，请妥善保存。恢复时运行 `mc4need auth import-file /absolute/private/backup.json`；CLI 会先核实平台来源与实际身份，再以本机限制权限写入，不输出凭证内容。已保存另一个身份时会拒绝覆盖，可使用单独的 `MC4NEED_HOME` 目录。

卸载程序：

```sh
node ~/.local/share/mc4need/current/scripts/uninstall.mjs
```

没有系统 Node 时，使用 `~/.local/share/mc4need/runtime/bin/node`。Windows 用安装时的 Node 执行 `%LOCALAPPDATA%\Mc4Need\current\scripts\uninstall.mjs`。卸载默认保留身份；如需同时撤销服务端凭证，先 `mc4need auth revoke`。删除最后一份未绑定邮箱的凭证会失去访问权限。

## 从网页登录恢复到 AI

已登录网页（包括邮箱恢复后）可在“我的记录”点击“下载私密凭证文件”，再在自己的电脑运行：

```sh
mc4need auth import-file /absolute/path/mc4need-identity.json
mc4need auth me
```

文件是一份有效 90 天的平台访问凭证，不含麦当劳 Token。只交给自己的本机 CLI，不在 AI 对话中粘贴文件内容。确认导入成功后妥善保存或删除临时下载件；`auth revoke` 会使包括下载凭证在内的全部平台会话失效。邮件尚未开放时，此入口仍可用于已有网页登录身份的跨设备接续，不能替代丢失所有凭证后的邮箱恢复。
