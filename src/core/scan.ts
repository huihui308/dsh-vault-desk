import { App, TFile } from "obsidian";
import type { BlueprintSettings } from "../settings";
import type { DirNode, Issue, IssueKind, ScanResult } from "../types";

export function isUnder(path: string, prefix: string): boolean {
  if (!prefix) return false;
  return path === prefix || path.startsWith(prefix + "/");
}

export function makeExcluder(settings: BlueprintSettings) {
  const prefixes = settings.excludeFolders.filter(Boolean);
  return (path: string) => prefixes.some((p) => isUnder(path, p));
}

export function isRawPath(path: string, settings: BlueprintSettings): boolean {
  return settings.rawFolders.filter(Boolean).some((p) => isUnder(path, p));
}

function emptyCounts(): Record<IssueKind, number> {
  return {
    "dangling-link": 0,
    orphan: 0,
    "missing-description": 0,
    "missing-type": 0,
    "missing-tags": 0,
    "tag-longtail": 0,
    "uncompiled-clipping": 0,
    "large-file": 0,
    "duplicate-name": 0,
    "stale-inbox": 0,
  };
}

function buildTree(files: TFile[]): DirNode {
  const root: DirNode = { path: "", name: "/", files: 0, totalFiles: 0, bytes: 0, children: [] };
  const index = new Map<string, DirNode>([["", root]]);

  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
    let parentPath = "";
    for (const part of parts) {
      const path = parentPath ? parentPath + "/" + part : part;
      let node = index.get(path);
      if (!node) {
        node = { path, name: part, files: 0, totalFiles: 0, bytes: 0, children: [] };
        index.set(path, node);
        index.get(parentPath)!.children.push(node);
      }
      parentPath = path;
    }
    const dirNode = index.get(parentPath)!;
    dirNode.files += 1;
    dirNode.bytes += file.stat.size;
  }

  const finalize = (node: DirNode): { total: number } => {
    let total = node.files;
    for (const child of node.children) total += finalize(child).total;
    node.totalFiles = total;
    node.children.sort((a, b) => b.totalFiles - a.totalFiles || a.name.localeCompare(b.name));
    return { total };
  };
  finalize(root);
  return root;
}

function frontmatterOf(app: App, file: TFile): Record<string, unknown> {
  const cache = app.metadataCache.getFileCache(file);
  return (cache?.frontmatter ?? {}) as Record<string, unknown>;
}

function tagsOf(app: App, file: TFile): string[] {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache) return [];
  const out = new Set<string>();
  for (const t of cache.tags ?? []) out.add(t.tag.replace(/^#/, ""));
  const fmTags = (cache.frontmatter as Record<string, unknown> | undefined)?.tags;
  if (Array.isArray(fmTags)) {
    for (const t of fmTags) if (typeof t === "string") out.add(t.replace(/^#/, ""));
  } else if (typeof fmTags === "string") {
    out.add(fmTags.replace(/^#/, ""));
  }
  return [...out];
}

export async function scanVault(app: App, settings: BlueprintSettings): Promise<ScanResult> {
  const started = Date.now();
  const excluded = makeExcluder(settings);
  const all = app.vault.getMarkdownFiles();
  const files = all.filter((f) => !excluded(f.path));
  const fileByPath = new Map(files.map((f) => [f.path, f] as const));

  const issues: Issue[] = [];
  const counts = emptyCounts();

  const push = (issue: Issue) => {
    issues.push(issue);
    counts[issue.kind] += 1;
  };

  // ---- dangling links (metadataCache authoritative) ----
  const unresolved = app.metadataCache.unresolvedLinks ?? {};
  const dangling: ScanResult["dangling"] = [];
  for (const [sourcePath, targets] of Object.entries(unresolved)) {
    if (excluded(sourcePath)) continue;
    const source = fileByPath.get(sourcePath);
    if (!source) continue;
    for (const [target, count] of Object.entries(targets)) {
      dangling.push({ source, target, count });
      push({
        kind: "dangling-link",
        severity: "error",
        file: source,
        path: sourcePath,
        target,
        detail: "指向不存在的笔记：" + target,
      });
    }
  }

  // ---- inbound link counting for orphans ----
  const resolved = app.metadataCache.resolvedLinks ?? {};
  const inbound = new Map<string, number>();
  for (const sources of Object.values(resolved)) {
    for (const targetPath of Object.keys(sources)) {
      inbound.set(targetPath, (inbound.get(targetPath) ?? 0) + 1);
    }
  }
  const orphans: TFile[] = [];
  for (const file of files) {
    if (isRawPath(file.path, settings)) continue;
    if (file.path.startsWith("Inbox/")) continue;
    if (file.basename.startsWith("MOC-")) continue;
    if ((inbound.get(file.path) ?? 0) > 0) continue;
    const fm = frontmatterOf(app, file);
    if (fm.type === "moc" || fm.doc_type === "index") continue;
    orphans.push(file);
    push({
      kind: "orphan",
      severity: "warn",
      file,
      path: file.path,
      detail: "没有任何笔记链接到它",
    });
  }

  // ---- frontmatter / tags ----
  const byType = new Map<string, number>();
  const byTag = new Map<string, number>();
  const knownTopics = new Set(settings.knownTopics);
  for (const file of files) {
    const fm = frontmatterOf(app, file);
    const tags = tagsOf(app, file);
    const type = typeof fm.type === "string" ? fm.type : "";
    if (type) byType.set(type, (byType.get(type) ?? 0) + 1);
    for (const tag of tags) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);

    if (!isRawPath(file.path, settings)) {
      if (!type) {
        push({ kind: "missing-type", severity: "warn", file, path: file.path, detail: "frontmatter 缺 type" });
      }
      if (tags.length === 0) {
        push({ kind: "missing-tags", severity: "warn", file, path: file.path, detail: "frontmatter 缺 tags" });
      }
      const desc = fm.description ?? fm.summary;
      if (!desc) {
        push({
          kind: "missing-description",
          severity: "warn",
          file,
          path: file.path,
          detail: "frontmatter 缺 description（检索/预筛的摘要层）",
        });
      }
      for (const tag of tags) {
        if (!tag.startsWith("topic/")) continue;
        const value = tag.slice("topic/".length);
        if (knownTopics.size > 0 && !knownTopics.has(value)) {
          push({
            kind: "tag-longtail",
            severity: "info",
            file,
            path: file.path,
            target: tag,
            detail: "topic 取值不在收敛表：" + tag,
          });
        }
      }
    }
  }

  // ---- uncompiled clippings ----
  const uncompiled: TFile[] = [];
  for (const file of files) {
    const fm = frontmatterOf(app, file);
    const isClip = file.path.startsWith("Clippings/") || fm.type === "clippings";
    if (!isClip) continue;
    if (fm.compiled === true || Array.isArray(fm.compiled_to)) continue;
    uncompiled.push(file);
    push({
      kind: "uncompiled-clipping",
      severity: "info",
      file,
      path: file.path,
      detail: "外部剪藏尚未编译进笔记区",
    });
  }

  // ---- large files ----
  const largeFiles: TFile[] = [];
  const limit = settings.largeFileKB * 1024;
  if (settings.largeFileKB > 0) {
    for (const file of files) {
      if (file.stat.size <= limit) continue;
      largeFiles.push(file);
      push({
        kind: "large-file",
        severity: "info",
        file,
        path: file.path,
        detail: "超过 " + settings.largeFileKB + " KB，考虑拆分",
      });
    }
  }

  // ---- duplicate basenames ----
  const byName = new Map<string, TFile[]>();
  for (const file of files) {
    const list = byName.get(file.basename) ?? [];
    list.push(file);
    byName.set(file.basename, list);
  }
  const duplicateNames: ScanResult["duplicateNames"] = [];
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    duplicateNames.push({ name, files: list });
    for (const file of list) {
      push({
        kind: "duplicate-name",
        severity: "info",
        file,
        path: file.path,
        target: name,
        detail: "同名笔记 " + list.length + " 篇，跨目录裸链接会歧义",
      });
    }
  }

  // ---- stale inbox ----
  const now = Date.now();
  if (settings.staleInboxDays > 0) {
    const cutoff = now - settings.staleInboxDays * 86400000;
    for (const file of files) {
      if (!file.path.startsWith("Inbox/")) continue;
      if (file.stat.mtime > cutoff) continue;
      push({
        kind: "stale-inbox",
        severity: "info",
        file,
        path: file.path,
        detail: "Inbox 停留超过 " + settings.staleInboxDays + " 天",
      });
    }
  }

  const totalBytes = files.reduce((sum, f) => sum + f.stat.size, 0);
  const sortedByMtime = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime);

  return {
    scannedAt: Date.now(),
    durationMs: Date.now() - started,
    totalFiles: files.length,
    totalBytes,
    files,
    issues,
    counts,
    tree: buildTree(files),
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byTag: [...byTag.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    dangling,
    orphans,
    uncompiled,
    largeFiles,
    duplicateNames,
    recent: sortedByMtime.slice(0, 20),
    untouched: sortedByMtime.slice(-20).reverse(),
  };
}