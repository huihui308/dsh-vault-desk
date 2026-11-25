import { TFile } from "obsidian";

export type IssueKind =
  | "dangling-link"
  | "orphan"
  | "missing-description"
  | "missing-type"
  | "missing-tags"
  | "tag-longtail"
  | "uncompiled-clipping"
  | "large-file"
  | "duplicate-name"
  | "stale-inbox";

export type Severity = "error" | "warn" | "info";

export interface Issue {
  kind: IssueKind;
  severity: Severity;
  file: TFile | null;
  path: string;
  detail: string;
  target?: string;
}

export interface DirNode {
  path: string;
  name: string;
  files: number;
  totalFiles: number;
  bytes: number;
  children: DirNode[];
}

export interface MoveRecord {
  from: string;
  to: string;
  at: number;
}

export interface ScanResult {
  scannedAt: number;
  durationMs: number;
  totalFiles: number;
  totalBytes: number;
  files: TFile[];
  issues: Issue[];
  counts: Record<IssueKind, number>;
  tree: DirNode;
  byType: Array<{ type: string; count: number }>;
  byTag: Array<{ tag: string; count: number }>;
  dangling: Array<{ source: TFile; target: string; count: number }>;
  orphans: TFile[];
  uncompiled: TFile[];
  largeFiles: TFile[];
  duplicateNames: Array<{ name: string; files: TFile[] }>;
  recent: TFile[];
  untouched: TFile[];
}
export type TabId = "overview" | "health" | "files" | "move";

export interface ViewContext {
  app: import("obsidian").App;
  scan: ScanResult | null;
  setTab: (tab: TabId) => void;
  refresh: () => Promise<void>;
  openFile: (file: import("obsidian").TFile) => void;
  notify: (message: string) => void;
  excludeFolders: string[];
  confirmBeforeMove: boolean;
}