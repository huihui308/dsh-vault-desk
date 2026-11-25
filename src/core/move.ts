import { App, TFile, TFolder } from "obsidian";

export function listFolders(app: App, exclude: (path: string) => boolean): string[] {
  const out: string[] = [""];
  const walk = (folder: TFolder) => {
    for (const child of folder.children) {
      if (child instanceof TFolder) {
        if (exclude(child.path)) continue;
        out.push(child.path);
        walk(child);
      }
    }
  };
  walk(app.vault.getRoot());
  return out.sort((a, b) => a.localeCompare(b));
}

export function validateMove(app: App, file: TFile, destFolder: string): { ok: boolean; message: string; target: string } {
  const target = destFolder ? destFolder + "/" + file.name : file.name;
  if (target === file.path) return { ok: false, message: "目标路径与当前相同", target };
  if (target.startsWith(file.path + "/")) return { ok: false, message: "不能移动到自身子目录", target };
  const existing = app.vault.getAbstractFileByPath(target);
  if (existing) return { ok: false, message: "目标位置已有同名文件：" + target, target };
  const parent = app.vault.getAbstractFileByPath(destFolder || "/");
  if (destFolder && !(parent instanceof TFolder)) {
    return { ok: false, message: "目标目录不存在：" + destFolder, target };
  }
  return { ok: true, message: "可以移动", target };
}

export async function moveFile(app: App, file: TFile, destFolder: string): Promise<string> {
  const check = validateMove(app, file, destFolder);
  if (!check.ok) throw new Error(check.message);
  await app.fileManager.renameFile(file, check.target);
  return check.target;
}
