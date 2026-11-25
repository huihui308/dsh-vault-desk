# 库工作台（dsh-vault-desk）

DeepSeek Harness 插件：一个面板看清整个 vault，顺手改。

## 面板

| 面板 | 内容 |
|---|---|
| **总览** | 目录结构树（篇数/大小）、frontmatter type 分布、标签 Top 12、扫描耗时 |
| **体检** | 断链、孤儿、缺 description/type/tags、标签长尾、未编译剪藏、大文件、同名笔记、Inbox 积压；按类别/级别/关键词筛选，点击跳到文件 |
| **文件** | 全库搜索，读原文、改原文、保存（走 /vault-desk/file 接口） |
| **移动** | 选文件、选目标目录、预览新路径，移动后自动重写所有带路径的 wiki-link 与 markdown 链接 |

## 安装

插件是 DSH profile 里的一个 link 包：

```bash
dsh plugin --profile web add link:/mnt/sdb1/agent/vault-desk
# 或直接改 ~/.dsh/profiles/web/package.json 的 dependencies 后 pnpm install
```

然后重启 dsh web（本机用仓库里的 reload.sh，或者手动 kill 后 `dsh web`）。
重启后侧栏出现「库工作台」图标，主视图 key 为 `dsh-vault-desk`。

## 配置

首次启动读 `/mnt/sdb1/agent/david-wiki`，可在设置文件里改：

```
~/.dsh/vault-desk.json
```

```json
{
  "vaultPath": "/mnt/sdb1/agent/david-wiki",
  "excludeFolders": [".git", ".obsidian", ".claude", ".dsh", ".agents", ".deja", "node_modules", "raw", "99-附件"],
  "rawFolders": ["Clippings", "templates", "99-附件"],
  "knownTopics": ["signal-control", "ai-agent", "..."],
  "largeFileKB": 200,
  "staleInboxDays": 14
}
```

`knownTopics` 决定哪些 `topic/*` 算长尾；默认是按 david-wiki 的收敛表填的。

## HTTP 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/vault-desk/scan` | 全量扫描（树、类型、标签、问题清单） |
| GET | `/vault-desk/file?path=` | 读单个文件 |
| POST | `/vault-desk/file` | 写文件 `{path, content}` |
| GET | `/vault-desk/folders` | 目录列表 |
| POST | `/vault-desk/move` | 移动 `{path, dest}`，返回被重写引用的文件 |
| POST | `/vault-desk/report` | 生成体检报告到 Inbox/ |
| GET/POST | `/vault-desk/settings` | 读写设置 |

## 边界

- 断链判定先剔除围栏代码块与行内代码，避免把文档里的 `[[示例]]` 当断链（这是上一版外部脚本误报 70 处的根因）。
- 移动只改「带路径」的链接；裸名 `[[文件名]]` 按文件名解析，移动后仍然有效。
- 路径统一走 `safeJoin` 校验，越出 vault 根目录直接 400。
- 每个请求都过 `connection.requestRejection`，接口不裸奔。

## 开发

纯 ESM，无构建步骤。改完 host 侧需要重启 dsh web；client 侧改动刷新浏览器即可（若开启了插件热更新）。

```bash
node --input-type=module -e "import { scanVault, DEFAULT_SETTINGS } from './src/scan.js'; const r = await scanVault(DEFAULT_SETTINGS); console.log(r.totalFiles, r.issues.length)"
```

## License

MIT
