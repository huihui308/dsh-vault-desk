export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return (i === 0 ? String(Math.round(value)) : value.toFixed(1)) + " " + units[i];
}

export function formatRelative(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
  if (diff < day) return Math.floor(diff / 3600000) + " 小时前";
  if (diff < day * 30) return Math.floor(diff / day) + " 天前";
  return new Date(ts).toLocaleDateString("zh-CN");
}

export function formatDateTime(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

export function shortPath(path: string, max = 72): string {
  if (path.length <= max) return path;
  return "…" + path.slice(path.length - max + 1);
}

export const ISSUE_LABEL: Record<string, string> = {
  "dangling-link": "断链",
  orphan: "孤儿",
  "missing-description": "缺摘要",
  "missing-type": "缺 type",
  "missing-tags": "缺标签",
  "tag-longtail": "标签长尾",
  "uncompiled-clipping": "未编译剪藏",
  "large-file": "大文件",
  "duplicate-name": "同名笔记",
  "stale-inbox": "Inbox 积压",
};

export const SEVERITY_LABEL: Record<string, string> = {
  error: "错误",
  warn: "警告",
  info: "提示",
};
