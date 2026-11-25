import { TFile } from "obsidian";
import type { ViewContext } from "../types";
import { listFolders, moveFile, validateMove } from "../core/move";
import { isUnder } from "../core/scan";
import { formatRelative } from "../core/format";

interface MoveEntry {
  from: string;
  to: string;
  at: number;
}

const history: MoveEntry[] = [];

export function renderMove(el: HTMLElement, ctx: ViewContext): void {
  const scan = ctx.scan;
  if (!scan) return;

  const exclude = (path: string) => ctx.excludeFolders.some((prefix) => isUnder(path, prefix));
  const folders = listFolders(ctx.app, exclude);

  const layout = el.createDiv({ cls: "vb-move-layout" });
  const left = layout.createDiv({ cls: "vb-move-picker" });
  const right = layout.createDiv({ cls: "vb-move-form" });

  left.createEl("h3", { text: "选择要移动的文件" });
  const search = left.createEl("input", { type: "text", placeholder: "搜索文件名 / 路径" });
  const rows = left.createDiv({ cls: "vb-file-rows" });
  const allFiles = [...scan.files].sort((a, b) => a.path.localeCompare(b.path));

  let selected: TFile | null = null;
  let destFolder = "";

  const form = right.createDiv({ cls: "vb-move-fields" });

  const drawForm = (): void => {
    form.empty();
    if (!selected) {
      form.createDiv({ cls: "vb-empty", text: "先在左侧选一个文件" });
      drawHistory();
      return;
    }
    const current = form.createDiv({ cls: "vb-move-row" });
    current.createSpan({ cls: "vb-move-label", text: "当前路径" });
    current.createSpan({ cls: "vb-move-value", text: selected.path });

    const destRow = form.createDiv({ cls: "vb-move-row" });
    destRow.createSpan({ cls: "vb-move-label", text: "目标目录" });
    const select = destRow.createEl("select", { cls: "vb-move-select" });
    for (const folder of folders) {
      select.createEl("option", { text: folder || "(库根)", value: folder });
    }
    if (destFolder) select.value = destFolder;
    select.addEventListener("change", () => {
      destFolder = select.value;
      drawForm();
    });

    const check = validateMove(ctx.app, selected, destFolder);
    const previewRow = form.createDiv({ cls: "vb-move-row" });
    previewRow.createSpan({ cls: "vb-move-label", text: "新路径" });
    previewRow.createSpan({
      cls: "vb-move-value" + (check.ok ? "" : " is-invalid"),
      text: check.target,
    });

    const note = form.createDiv({
      cls: "vb-move-note" + (check.ok ? "" : " is-invalid"),
      text: check.ok
        ? "移动会通过 Obsidian 的文件管理器执行，全库引用链接会自动更新。"
        : check.message,
    });

    const button = form.createEl("button", { cls: "mod-cta", text: "移动到该目录" });
    button.toggleAttribute("disabled", !check.ok);
    button.addEventListener("click", async () => {
      if (!selected) return;
      if (ctx.confirmBeforeMove && !window.confirm("移动 " + selected.path + "\n→ " + check.target + "？\n\n全库链接将自动更新。")) {
        return;
      }
      const file = selected;
      try {
        const target = await moveFile(ctx.app, file, destFolder);
        history.unshift({ from: file.path, to: target, at: Date.now() });
        ctx.notify("已移动：" + target);
        await ctx.refresh();
      } catch (error) {
        ctx.notify("移动失败：" + (error as Error).message);
      }
    });

    drawHistory();
  };

  const historyBox = right.createDiv({ cls: "vb-move-history" });
  const drawHistory = (): void => {
    historyBox.empty();
    if (history.length === 0) return;
    historyBox.createEl("h3", { text: "最近移动" });
    for (const entry of history.slice(0, 8)) {
      const row = historyBox.createDiv({ cls: "vb-history-row" });
      row.createSpan({ cls: "vb-history-path", text: entry.from + " → " + entry.to });
      row.createSpan({ cls: "vb-history-time", text: formatRelative(entry.at) });
    }
  };

  const drawList = (): void => {
    rows.empty();
    const query = search.value.trim().toLowerCase();
    const filtered = query ? allFiles.filter((f) => f.path.toLowerCase().includes(query)) : allFiles;
    for (const file of filtered.slice(0, 300)) {
      const row = rows.createDiv({ cls: "vb-file-row" + (selected?.path === file.path ? " is-active" : "") });
      row.createSpan({ cls: "vb-file-name", text: file.path });
      row.addEventListener("click", () => {
        selected = file;
        destFolder = file.parent?.path ?? "";
        drawList();
        drawForm();
      });
    }
  };

  search.addEventListener("input", drawList);
  drawList();
  drawForm();
}
