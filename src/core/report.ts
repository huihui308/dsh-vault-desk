import { App, TFile } from "obsidian";
import type { ScanResult } from "../types";
import { ISSUE_LABEL, formatBytes, formatDateTime } from "./format";
import { normalizePrefix } from "../settings";

export function buildReport(scan: ScanResult, scanLabel: string): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push('title: "蓝图体检报告 ' + scanLabel + '"');
  lines.push("type: reference");
  lines.push("doc_type: personal");
  lines.push("tags: [type/personal, topic/knowledge-management]");
  lines.push('description: "Vault Blueprint 自动导出的结构与体检快照"');
  lines.push("created: " + scanLabel);
  lines.push("updated: " + scanLabel);
  lines.push("---");
  lines.push("");
  lines.push("# 蓝图体检报告 " + scanLabel);
  lines.push("");
  lines.push("扫描时间：" + formatDateTime(scan.scannedAt) + "，耗时 " + scan.durationMs + " ms");
  lines.push("");
  lines.push("## 总览");
  lines.push("");
  lines.push("| 指标 | 数值 |");
  lines.push("|---|---|");
  lines.push("| 笔记数 | " + scan.totalFiles + " |");
  lines.push("| 总大小 | " + formatBytes(scan.totalBytes) + " |");
  lines.push("| 问题数 | " + scan.issues.length + " |");
  lines.push("| 断链 | " + scan.counts["dangling-link"] + " |");
  lines.push("| 孤儿 | " + scan.counts.orphan + " |");
  lines.push("| 缺摘要 | " + scan.counts["missing-description"] + " |");
  lines.push("| 未编译剪藏 | " + scan.counts["uncompiled-clipping"] + " |");
  lines.push("");
  lines.push("## 问题明细");
  lines.push("");
  const kinds = Object.keys(scan.counts).filter((k) => scan.counts[k as keyof typeof scan.counts] > 0);
  for (const kind of kinds) {
    lines.push("### " + (ISSUE_LABEL[kind] ?? kind) + "（" + scan.counts[kind as keyof typeof scan.counts] + "）");
    lines.push("");
    for (const issue of scan.issues.filter((i) => i.kind === kind).slice(0, 200)) {
      lines.push("- " + (issue.target ? issue.target + " ← " : "") + issue.path + " — " + issue.detail);
    }
    if (scan.counts[kind as keyof typeof scan.counts] > 200) lines.push("- …（超出 200 条，见插件面板）");
    lines.push("");
  }
  lines.push("## 目录分布");
  lines.push("");
  lines.push("| 目录 | 笔记数 | 大小 |");
  lines.push("|---|---|---|");
  for (const child of scan.tree.children) {
    lines.push("| " + (child.path || "/") + " | " + child.totalFiles + " | " + formatBytes(child.bytes) + " |");
  }
  lines.push("");
  return lines.join("\n");
}

export async function writeReport(app: App, scan: ScanResult, folder: string): Promise<TFile> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
    "_" + pad(now.getHours()) + pad(now.getMinutes());
  const folderPath = normalizePrefix(folder || "Inbox");
  const dir = app.vault.getAbstractFileByPath(folderPath);
  if (!dir) await app.vault.createFolder(folderPath).catch(() => undefined);
  const path = folderPath + "/_蓝图体检_" + stamp + ".md";
  const content = buildReport(scan, stamp.slice(0, 10));
  const existed = app.vault.getAbstractFileByPath(path);
  if (existed instanceof TFile) {
    await app.vault.modify(existed, content);
    return existed;
  }
  return await app.vault.create(path, content);
}
