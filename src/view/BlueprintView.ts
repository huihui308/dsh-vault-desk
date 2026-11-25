import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type VaultBlueprintPlugin from "../main";
import type { ScanResult, TabId, ViewContext } from "../types";
import { formatDateTime } from "../core/format";
import { renderOverview } from "./renderOverview";
import { renderHealth } from "./renderHealth";
import { renderFiles } from "./renderFiles";
import { renderMove } from "./renderMove";

export const VIEW_TYPE_BLUEPRINT = "vault-blueprint-view";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "health", label: "体检" },
  { id: "files", label: "文件" },
  { id: "move", label: "移动" },
];

export class BlueprintView extends ItemView {
  private plugin: VaultBlueprintPlugin;
  private tab: TabId = "overview";
  private scan: ScanResult | null = null;
  private loading = false;
  private error: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: VaultBlueprintPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_BLUEPRINT;
  }

  getDisplayText(): string {
    return "库蓝图";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.render();
    try {
      this.scan = await this.plugin.runScan(true);
    } catch (error) {
      this.error = (error as Error).message;
    }
    this.loading = false;
    this.render();
  }

  private buildContext(): ViewContext {
    return {
      app: this.app,
      scan: this.scan,
      setTab: (tab: TabId) => {
        this.tab = tab;
        this.render();
      },
      refresh: () => this.refresh(),
      openFile: (file: TFile) => {
        void this.app.workspace.getLeaf("tab").openFile(file);
      },
      notify: (message: string) => new Notice(message),
      excludeFolders: this.plugin.settings.excludeFolders,
      confirmBeforeMove: this.plugin.settings.confirmBeforeMove,
    };
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("vb-root");

    const header = root.createDiv({ cls: "vb-header" });
    const titleBox = header.createDiv({ cls: "vb-title-box" });
    titleBox.createEl("h2", { text: "库蓝图" });
    titleBox.createDiv({
      cls: "vb-sub",
      text: this.scan
        ? this.scan.totalFiles + " 篇 · " + this.scan.issues.length + " 个问题 · 扫描 " + formatDateTime(this.scan.scannedAt)
        : "尚未扫描",
    });

    const actions = header.createDiv({ cls: "vb-actions" });
    const refreshBtn = actions.createEl("button", { text: this.loading ? "扫描中…" : "重新扫描" });
    refreshBtn.addEventListener("click", () => void this.refresh());
    refreshBtn.toggleAttribute("disabled", this.loading);

    const exportBtn = actions.createEl("button", { text: "导出报告" });
    exportBtn.addEventListener("click", async () => {
      if (!this.scan) return;
      const file = await (await import("../core/report")).writeReport(this.app, this.scan, "Inbox");
      new Notice("报告已写入 " + file.path);
    });

    const settingsBtn = actions.createEl("button", { text: "设置" });
    settingsBtn.addEventListener("click", () => {
      const setting = (this.app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting;
      setting.open();
      setting.openTabById(this.plugin.manifest.id);
    });

    const tabs = root.createDiv({ cls: "vb-tabs" });
    for (const tab of TABS) {
      const btn = tabs.createEl("button", {
        cls: "vb-tab" + (this.tab === tab.id ? " is-active" : ""),
        text: tab.label,
      });
      btn.addEventListener("click", () => {
        this.tab = tab.id;
        this.render();
      });
    }

    const body = root.createDiv({ cls: "vb-body" });

    if (this.error) {
      body.createDiv({ cls: "vb-error", text: "扫描失败：" + this.error });
      return;
    }
    if (this.loading || !this.scan) {
      body.createDiv({ cls: "vb-loading", text: "正在扫描全库…" });
      return;
    }

    const ctx = this.buildContext();
    if (this.tab === "overview") renderOverview(body, ctx);
    else if (this.tab === "health") renderHealth(body, ctx);
    else if (this.tab === "files") renderFiles(body, ctx);
    else renderMove(body, ctx);
  }
}