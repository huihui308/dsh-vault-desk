import type { IssueKind, Severity, ViewContext } from "../types";
import { ISSUE_LABEL, SEVERITY_LABEL } from "../core/format";

export function renderHealth(el: HTMLElement, ctx: ViewContext): void {
  const scan = ctx.scan;
  if (!scan) return;

  const controls = el.createDiv({ cls: "vb-controls" });

  const kindSelect = controls.createEl("select");
  kindSelect.createEl("option", { text: "全部类别", value: "all" });
  for (const kind of Object.keys(scan.counts) as IssueKind[]) {
    if (scan.counts[kind] === 0) continue;
    kindSelect.createEl("option", { text: (ISSUE_LABEL[kind] ?? kind) + "（" + scan.counts[kind] + "）", value: kind });
  }

  const severitySelect = controls.createEl("select");
  severitySelect.createEl("option", { text: "全部级别", value: "all" });
  for (const severity of ["error", "warn", "info"] as Severity[]) {
    severitySelect.createEl("option", { text: SEVERITY_LABEL[severity], value: severity });
  }

  const searchInput = controls.createEl("input", { type: "text", placeholder: "按路径 / 详情筛选" });
  const summary = controls.createSpan({ cls: "vb-controls-summary" });

  const list = el.createDiv({ cls: "vb-health-list" });

  const draw = (): void => {
    list.empty();
    const kind = kindSelect.value;
    const severity = severitySelect.value;
    const query = searchInput.value.trim().toLowerCase();
    const issues = scan.issues.filter((issue) => {
      if (kind !== "all" && issue.kind !== kind) return false;
      if (severity !== "all" && issue.severity !== severity) return false;
      if (query && !(issue.path + " " + issue.detail + " " + (issue.target ?? "")).toLowerCase().includes(query)) return false;
      return true;
    });
    summary.setText("匹配 " + issues.length + " 条 / 共 " + scan.issues.length + " 条");
    if (issues.length === 0) {
      list.createDiv({ cls: "vb-empty", text: "没有匹配的问题" });
      return;
    }
    for (const issue of issues.slice(0, 800)) {
      const row = list.createDiv({ cls: "vb-issue is-" + issue.severity });
      const head = row.createDiv({ cls: "vb-issue-head" });
      head.createSpan({ cls: "vb-badge is-" + issue.severity, text: SEVERITY_LABEL[issue.severity] });
      head.createSpan({ cls: "vb-issue-kind", text: ISSUE_LABEL[issue.kind] ?? issue.kind });
      head.createSpan({ cls: "vb-issue-path", text: issue.path });
      row.createDiv({ cls: "vb-issue-detail", text: issue.detail });
      if (issue.file) {
        row.addEventListener("click", () => issue.file && ctx.openFile(issue.file));
      }
    }
    if (issues.length > 800) list.createDiv({ cls: "vb-empty", text: "仅显示前 800 条，导出报告看全量" });
  };

  kindSelect.addEventListener("change", draw);
  severitySelect.addEventListener("change", draw);
  searchInput.addEventListener("input", draw);
  draw();
}
