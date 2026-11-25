import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { BlueprintView, VIEW_TYPE_BLUEPRINT } from "./view/BlueprintView";
import { BlueprintSettingTab, DEFAULT_SETTINGS, type BlueprintSettings } from "./settings";
import { scanVault } from "./core/scan";
import { writeReport } from "./core/report";
import type { ScanResult } from "./types";

export default class VaultBlueprintPlugin extends Plugin {
  settings: BlueprintSettings = DEFAULT_SETTINGS;
  lastScan: ScanResult | null = null;
  private pending: Promise<ScanResult> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_BLUEPRINT, (leaf: WorkspaceLeaf) => new BlueprintView(leaf, this));

    this.addRibbonIcon("layout-dashboard", "打开库蓝图", () => this.activateView());

    this.addCommand({
      id: "open-blueprint",
      name: "打开库蓝图面板",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "rescan-vault",
      name: "重新扫描全库",
      callback: async () => {
        const result = await this.runScan(true);
        new Notice("库蓝图：" + result.totalFiles + " 篇，问题 " + result.issues.length + " 个，耗时 " + result.durationMs + " ms");
      },
    });

    this.addCommand({
      id: "export-report",
      name: "导出体检报告到 Inbox",
      callback: async () => {
        const result = await this.runScan();
        const file = await writeReport(this.app, result, "Inbox");
        new Notice("报告已写入 " + file.path);
      },
    });

    this.addSettingTab(new BlueprintSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_BLUEPRINT);
  }

  async runScan(force = false): Promise<ScanResult> {
    if (this.pending && !force) return this.pending;
    const run = scanVault(this.app, this.settings).then((result) => {
      this.lastScan = result;
      this.pending = null;
      return result;
    }).catch((error) => {
      this.pending = null;
      throw error;
    });
    this.pending = run;
    return run;
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_BLUEPRINT)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE_BLUEPRINT, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<BlueprintSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
