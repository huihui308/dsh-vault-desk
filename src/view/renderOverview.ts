import type { DirNode, ViewContext } from "../types";
import { formatBytes, formatRelative } from "../core/format";

function statCard(parent: HTMLElement, label: string, value: string, tone?: string): void {
  const card = parent.createDiv({ cls: "vb-card" + (tone ? " is-" + tone : "") });
  card.createDiv({ cls: "vb-card-value", text: value });
  card.createDiv({ cls: "vb-card-label", text: label });
}

function renderTreeNode(parent: HTMLElement, node: DirNode, depth: number): void {
  const row = parent.createDiv({ cls: "vb-tree-row" });
  row.style.paddingLeft = depth * 14 + "px";
  const label = node.name === "/" ? "库根" : node.name;
  row.createSpan({ cls: "vb-tree-name", text: label });
  row.createSpan({ cls: "vb-tree-meta", text: node.totalFiles + " 篇 · " + formatBytes(node.bytes) });
  if (node.children.length > 0) {
    const children = parent.createDiv({ cls: "vb-tree-children" });
    for (const child of node.children) renderTreeNode(children, child, depth + 1);
    row.addClass("is-collapsible");
    row.addEventListener("click", () => {
      children.toggleClass("is-hidden", !children.hasClass("is-hidden"));
    });
  }
}

export function renderOverview(el: HTMLElement, ctx: ViewContext): void {
  const scan = ctx.scan;
  if (!scan) return;

  const cards = el.createDiv({ cls: "vb-cards" });
  statCard(cards, "笔记", String(scan.totalFiles));
  statCard(cards, "总大小", formatBytes(scan.totalBytes));
  statCard(cards, "断链", String(scan.counts["dangling-link"]), scan.counts["dangling-link"] > 0 ? "danger" : "ok");
  statCard(cards, "孤儿", String(scan.counts.orphan), scan.counts.orphan > 0 ? "warn" : "ok");
  statCard(cards, "缺摘要", String(scan.counts["missing-description"]), "warn");
  statCard(cards, "未编译剪藏", String(scan.counts["uncompiled-clipping"]), "warn");
  statCard(cards, "大文件", String(scan.counts["large-file"]));
  statCard(cards, "同名", String(scan.duplicateNames.length));

  const treeSection = el.createDiv({ cls: "vb-section" });
  treeSection.createEl("h3", { text: "目录结构" });
  const tree = treeSection.createDiv({ cls: "vb-tree" });
  renderTreeNode(tree, scan.tree, 0);

  const typeSection = el.createDiv({ cls: "vb-section" });
  typeSection.createEl("h3", { text: "类型分布（frontmatter.type）" });
  const maxType = Math.max(1, ...scan.byType.map((t) => t.count));
  for (const item of scan.byType.slice(0, 12)) {
    const row = typeSection.createDiv({ cls: "vb-bar-row" });
    row.createSpan({ cls: "vb-bar-label", text: item.type || "(空)" });
    const track = row.createDiv({ cls: "vb-bar-track" });
    const fill = track.createDiv({ cls: "vb-bar-fill" });
    fill.style.width = Math.round((item.count / maxType) * 100) + "%";
    row.createSpan({ cls: "vb-bar-value", text: String(item.count) });
  }
  if (scan.byType.length === 0) typeSection.createDiv({ cls: "vb-empty", text: "没有读到 type 字段" });

  const tagSection = el.createDiv({ cls: "vb-section" });
  tagSection.createEl("h3", { text: "标签 Top 12" });
  const maxTag = Math.max(1, ...scan.byTag.slice(0, 12).map((t) => t.count));
  for (const item of scan.byTag.slice(0, 12)) {
    const row = tagSection.createDiv({ cls: "vb-bar-row" });
    row.createSpan({ cls: "vb-bar-label", text: item.tag });
    const track = row.createDiv({ cls: "vb-bar-track" });
    const fill = track.createDiv({ cls: "vb-bar-fill is-tag" });
    fill.style.width = Math.round((item.count / maxTag) * 100) + "%";
    row.createSpan({ cls: "vb-bar-value", text: String(item.count) });
  }

  const recentSection = el.createDiv({ cls: "vb-section" });
  recentSection.createEl("h3", { text: "最近修改" });
  for (const file of scan.recent.slice(0, 10)) {
    const row = recentSection.createDiv({ cls: "vb-link-row" });
    row.createSpan({ cls: "vb-link-name", text: file.path });
    row.createSpan({ cls: "vb-link-meta", text: formatRelative(file.stat.mtime) });
    row.addEventListener("click", () => ctx.openFile(file));
  }
}
