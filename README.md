# Vault Blueprint

Obsidian 插件：一个面板看清整个 vault，顺手改。

## 功能

- **总览**：目录结构树、类型分布、标签分布、最近修改；一眼看到全库形状。
- **体检**：断链、孤儿、缺 description / type / tags、标签长尾、未编译剪藏、大文件、同名笔记、Inbox 积压。可筛选、可点击跳转、可导出 Markdown 报告到 `Inbox/`。
- **文件**：搜索全库文件，预览 frontmatter 与正文，一键打开原生编辑器修改。
- **移动**：选文件、选目标目录、预览新路径，通过 Obsidian 文件管理器移动——全库引用链接自动更新。

只读检查与写操作分离：默认不改库，只有你点「移动」才会写。

## 安装（手动）

1. 构建：`npm install && npm run build`，产出 `main.js`。
2. 把 `main.js`、`manifest.json`、`styles.css` 放进 `<vault>/.obsidian/plugins/vault-blueprint/`。
3. Obsidian 设置 → 第三方插件 → 启用 Vault Blueprint。

## 开发

```bash
npm install
npm run dev     # esbuild watch
npm run build   # tsc 类型检查 + 生产构建
```

## 设计边界

- 检查用 `app.metadataCache`，不自己正则扫 Markdown，避免把代码块里的 `[[...]]` 误判为断链。
- 移动只走 `app.fileManager.renameFile()`，让 Obsidian 更新引用；不手写路径替换。
- 阅读/修改调原生编辑器，插件不自研编辑器。
- 不做图数据库和 RAG：结构看目录/MOC/类型，语义判断交给外部 agent。

## 版本

- 0.1.0：总览、体检、文件浏览、移动四个面板。

## License

MIT
