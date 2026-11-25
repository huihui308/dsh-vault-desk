import { TFile } from "obsidian";
import type { ViewContext } from "../types";
import { formatBytes, formatRelative } from "../core/format";

export function renderFiles(el: HTMLElement, ctx: ViewContext): void {
  const scan = ctx.scan;
  if (!scan) return;

  const layout = el.createDiv({ cls: "vb-files-layout" });
  const left = layout.createDiv({ cls: "vb-files-list" });
  const right = layout.createDiv({ cls: "vb-files-preview" });

  const search = left.createEl("input", { type: "text", placeholder: "搜索文件名 / 路径" });
  const meta = left.createDiv({ cls: "vb-files-meta" });
  const rows = left.createDiv({ cls: "vb-file-rows" });

  const files = [...scan.files].sort((a, b) => b.stat.mtime - a.stat.mtime);
  let selected: TFile | null = null;

  const showPreview = async (file: TFile): Promise<void> => {
    right.empty();
    const head = right.createDiv({ cls: "vb-preview-head" });
    head.createDiv({ cls: "vb-preview-title", text: file.path });
    const actions = head.createDiv({ cls: "vb-preview-actions" });
    const openBtn = actions.createEl("button", { text: "打开编辑" });
    openBtn.addEventListener("click", () => ctx.openFile(file));

    right.createDiv({
      cls: "vb-preview-meta",
      text: formatBytes(file.stat.size) + " · 修改于 " + formatRelative(file.stat.mtime),
    });

    const cache = ctx.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter as Record<string, unknown> | undefined;
    if (fm) {
      const table = right.createDiv({ cls: "vb-fm" });
      for (const [key, value] of Object.entries(fm)) {
        const row = table.createDiv({ cls: "vb-fm-row" });
        row.createSpan({ cls: "vb-fm-key", text: key });
        row.createSpan({
          cls: "vb-fm-value",
          text: Array.isArray(value) ? value.join(", ") : String(value ?? ""),
        });
      }
    }

    const content = await ctx.app.vault.cachedRead(file);
    const body = content.replace(/^---[\s\S]*?\n---\n/, "");
    const preview = right.createEl("pre", { cls: "vb-preview-body" });
    preview.setText(body.slice(0, 2400) + (body.length > 2400 ? "\n…" : ""));
  };

  const drawList = (): void => {
    rows.empty();
    const query = search.value.trim().toLowerCase();
    const filtered = query ? files.filter((f) => f.path.toLowerCase().includes(query)) : files;
    meta.setText(filtered.length + " / " + files.length + " 篇");
    for (const file of filtered.slice(0, 400)) {
      const row = rows.createDiv({ cls: "vb-file-row" + (selected?.path === file.path ? " is-active" : "") });
      row.createSpan({ cls: "vb-file-name", text: file.path });
      row.createSpan({ cls: "vb-file-meta", text: formatBytes(file.stat.size) });
      row.addEventListener("click", () => {
        selected = file;
        drawList();
        void showPreview(file);
      });
    }
    if (filtered.length > 400) rows.createDiv({ cls: "vb-empty", text: "仅显示前 400 条，请继续输入缩小范围" });
  };

  search.addEventListener("input", drawList);
  drawList();
  right.createDiv({ cls: "vb-empty", text: "从左侧选择一个文件查看 frontmatter 与正文预览" });
}
