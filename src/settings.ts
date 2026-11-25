import { App, PluginSettingTab, Setting } from "obsidian";
import type VaultBlueprintPlugin from "./main";

export interface BlueprintSettings {
  /** 路径前缀，命中即从扫描里排除 */
  excludeFolders: string[];
  /** 认为必须有 description 的目录前缀（空数组 = 全库） */
  requireDescriptionIn: string[];
  /** 认可的主题标签取值；不在表内的 topic/* 记为长尾 */
  knownTopics: string[];
  /** 原始素材目录：不参与孤儿判定，也不要求 description */
  rawFolders: string[];
  /** Inbox 停留超过多少天算积压（0 = 关闭） */
  staleInboxDays: number;
  /** 超过多大算大文件（KB，0 = 关闭） */
  largeFileKB: number;
  /** 移动前是否要求确认 */
  confirmBeforeMove: boolean;
}

export const DEFAULT_SETTINGS: BlueprintSettings = {
  excludeFolders: [".git", ".obsidian", ".claude", ".dsh", ".agents", ".deja", "node_modules", "raw", "99-附件"],
  requireDescriptionIn: [],
  knownTopics: [
    "signal-control", "signal-timing", "intersection-optimization", "communication-protocol",
    "perception", "v2x", "green-wave", "traffic-detection", "intelligent-intersection",
    "ai-agent", "agent-architecture", "agent-infra", "claude", "claude-code", "harness",
    "loop-engineering", "graph-engineering", "context-engineering", "memory-engineering",
    "rag", "lightrag", "mcp", "obsidian", "dev-tools", "prompt-engineering", "algorithm",
    "knowledge-management", "short-video", "family-health", "pbc", "career-strategy",
    "interview", "beer-control", "rknn", "rk3588", "deepstream", "embedded", "edge-ai",
    "vlm", "computer-vision",
  ],
  rawFolders: ["Clippings", "templates", "99-附件"],
  staleInboxDays: 14,
  largeFileKB: 200,
  confirmBeforeMove: true,
};

export function normalizePrefix(p: string): string {
  return p.replace(/^\/+/, "").replace(/\/+$/, "");
}

export class BlueprintSettingTab extends PluginSettingTab {
  plugin: VaultBlueprintPlugin;

  constructor(app: App, plugin: VaultBlueprintPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Blueprint 设置" });

    new Setting(containerEl)
      .setName("排除目录（每行一个路径前缀）")
      .setDesc("这些目录不参与扫描、体检与统计")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.excludeFolders.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.excludeFolders = v.split("\n").map(normalizePrefix).filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("原始素材目录（每行一个）")
      .setDesc("不参与孤儿判定，也不要求 description；默认 Clippings、templates、99-附件")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.rawFolders.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.rawFolders = v.split("\n").map(normalizePrefix).filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("认可的主题标签（每行一个，不带 topic/ 前缀）")
      .setDesc("不在表内的 topic/* 记为标签长尾")
      .addTextArea((t) =>
        t
          .setValue(this.plugin.settings.knownTopics.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.knownTopics = v.split("\n").map((s) => s.trim()).filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("大文件阈值（KB）")
      .setDesc("超过该大小的笔记会进入体检报告；0 关闭")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.largeFileKB)).onChange(async (v) => {
          const n = Number(v);
          this.plugin.settings.largeFileKB = Number.isFinite(n) && n >= 0 ? n : 0;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Inbox 积压天数")
      .setDesc("Inbox 里超过该天数未处理的文件计入体检；0 关闭")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.staleInboxDays)).onChange(async (v) => {
          const n = Number(v);
          this.plugin.settings.staleInboxDays = Number.isFinite(n) && n >= 0 ? n : 0;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("移动文件前确认")
      .setDesc("移动会重写全库引用链接，建议保留确认")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.confirmBeforeMove).onChange(async (v) => {
          this.plugin.settings.confirmBeforeMove = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
