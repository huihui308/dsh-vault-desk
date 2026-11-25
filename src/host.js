// dsh-vault-desk 的 Host 半片：/vault-desk 接口、扫描、读文件、移动与引用重写。
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

import { DEFAULT_SETTINGS, scanVault } from './scan.js'
import { safeJoin, toPosix } from './vault.js'

export const name = 'dsh-vault-desk'
const MAX_JSON = 4_000_000

function settingsFile() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'vault-desk.json')
}

async function loadSettings() {
  try {
    const raw = await readFile(settingsFile(), 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(next) {
  const file = settingsFile()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(next, null, 2), 'utf8')
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_JSON) throw Object.assign(new Error('内容太大'), { status: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求不是有效的 JSON'), { status: 400 })
  }
}

/** 引用重写：只改带路径的 [[路径]] 与 [text](路径.md)，裸名链接按文件名解析不用动。 */
function rewriteText(text, oldRel, newRel) {
  const esc = oldRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let next = text
  next = next.replace(new RegExp('\\[\\[' + esc + '(?=[\\]|#])', 'g'), '[[' + newRel)
  next = next.replace(new RegExp('\\]\\(' + esc + '(?=[)#])', 'g'), '](' + newRel)
  return next
}

async function listFolders(root, settings) {
  const excluded = settings.excludeFolders.filter(Boolean)
  const out = ['']
  const walk = async (dir, rel) => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const childRel = rel ? rel + '/' + entry.name : entry.name
      if (excluded.some((p) => childRel === p || childRel.startsWith(p + '/'))) continue
      out.push(childRel)
      await walk(join(dir, entry.name), childRel)
    }
  }
  await walk(root, '')
  return out.sort((a, b) => a.localeCompare(b))
}

async function allMarkdown(root, settings) {
  const excluded = settings.excludeFolders.filter(Boolean)
  const out = []
  const walk = async (dir, rel) => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const childRel = rel ? rel + '/' + entry.name : entry.name
      if (entry.isDirectory()) {
        if (excluded.some((p) => childRel === p || childRel.startsWith(p + '/'))) continue
        await walk(join(dir, entry.name), childRel)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(childRel)
      }
    }
  }
  await walk(root, '')
  return out
}

function buildReport(scan) {
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
    ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes())
  const label = { 'dangling-link': '断链', orphan: '孤儿', 'missing-description': '缺摘要', 'missing-type': '缺 type', 'missing-tags': '缺标签', 'tag-longtail': '标签长尾', 'uncompiled-clipping': '未编译剪藏', 'large-file': '大文件', 'duplicate-name': '同名笔记', 'stale-inbox': 'Inbox 积压' }
  const lines = ['---', 'title: "蓝图体检报告 ' + stamp + '"', 'type: reference', 'doc_type: personal', 'tags: [type/personal, topic/knowledge-management]', 'created: ' + stamp.slice(0, 10), 'updated: ' + stamp.slice(0, 10), '---', '', '# 蓝图体检报告 ' + stamp, '', '扫描 ' + scan.totalFiles + ' 篇，问题 ' + scan.issues.length + ' 个，耗时 ' + scan.durationMs + ' ms。', '']
  for (const [kind, count] of Object.entries(scan.counts)) {
    if (!count) continue
    lines.push('## ' + (label[kind] || kind) + '（' + count + '）', '')
    scan.issues.filter((i) => i.kind === kind).slice(0, 300).forEach((i) => lines.push('- ' + (i.target ? i.target + ' ← ' : '') + i.path + ' — ' + i.detail))
    lines.push('')
  }
  return lines.join('\n')
}

async function route(ctx, req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname.replace(/^\/vault-desk/, '') || '/'
  const settings = await loadSettings()
  const root = settings.vaultPath

  if (req.method === 'GET' && path === '/settings') return json(res, 200, settings)
  if (req.method === 'POST' && path === '/settings') {
    const body = await readJson(req)
    const next = { ...settings, ...body }
    await saveSettings(next)
    return json(res, 200, next)
  }
  if (req.method === 'GET' && path === '/scan') {
    const scan = await scanVault(settings)
    return json(res, 200, scan)
  }
  if (req.method === 'GET' && path === '/folders') {
    return json(res, 200, { folders: await listFolders(root, settings) })
  }
  if (req.method === 'GET' && path === '/file') {
    const rel = url.searchParams.get('path') || ''
    if (!rel) return json(res, 400, { error: '缺少 path' })
    const abs = safeJoin(root, rel)
    const info = await stat(abs)
    const content = await readFile(abs, 'utf8')
    return json(res, 200, { path: rel, size: info.size, mtime: info.mtimeMs, content })
  }
  if (req.method === 'POST' && path === '/file') {
    const body = await readJson(req)
    if (!body.path || typeof body.content !== 'string') return json(res, 400, { error: '缺少 path 或 content' })
    const abs = safeJoin(root, body.path)
    await writeFile(abs, body.content, 'utf8')
    const info = await stat(abs)
    return json(res, 200, { path: body.path, size: info.size, mtime: info.mtimeMs })
  }
  if (req.method === 'POST' && path === '/move') {
    const body = await readJson(req)
    if (!body.path || typeof body.dest !== 'string') return json(res, 400, { error: '缺少 path 或 dest' })
    const oldRel = body.path.replace(/^\/+/, '')
    const name = basename(oldRel)
    const targetRel = body.dest ? body.dest.replace(/^\/+/, '').replace(/\/+$/, '') + '/' + name : name
    if (targetRel === oldRel) return json(res, 400, { error: '目标路径与当前相同' })
    const oldAbs = safeJoin(root, oldRel)
    const newAbs = safeJoin(root, targetRel)
    try {
      await stat(newAbs)
      return json(res, 409, { error: '目标位置已有同名文件：' + targetRel })
    } catch { /* 目标不存在，可以移动 */ }
    await mkdir(dirname(newAbs), { recursive: true })
    await rename(oldAbs, newAbs)
    let rewritten = []
    for (const rel of await allMarkdown(root, settings)) {
      const abs = safeJoin(root, rel)
      const text = await readFile(abs, 'utf8')
      const next = rewriteText(text, oldRel, targetRel)
      if (next !== text) {
        await writeFile(abs, next, 'utf8')
        rewritten.push(rel)
      }
    }
    return json(res, 200, { from: oldRel, to: targetRel, rewritten })
  }
  if (req.method === 'POST' && path === '/report') {
    const scan = await scanVault(settings)
    const pad = (n) => String(n).padStart(2, '0')
    const now = new Date()
    const stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes())
    const folder = 'Inbox'
    const absFolder = safeJoin(root, folder)
    await mkdir(absFolder, { recursive: true })
    const rel = folder + '/_蓝图体检_' + stamp + '.md'
    await writeFile(safeJoin(root, rel), buildReport(scan), 'utf8')
    return json(res, 200, { path: rel })
  }
  return json(res, 404, { error: '接口不存在' })
}

export function requestRejection(ctx, req) {
  const connection = ctx.get('connection')
  if (typeof connection?.requestRejection !== 'function') return 403
  return connection.requestRejection({ headers: req.headers })
}

export default {
  inject: ['webServer', 'connection'],
  apply(ctx) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: '/vault-desk',
      handler: async (req, res) => {
        try {
          const rejection = requestRejection(ctx, req)
          if (rejection) {
            json(res, rejection, { error: '未授权' })
            return
          }
          await route(ctx, req, res)
        } catch (err) {
          if (res.headersSent) {
            try { res.end() } catch { /* 已断开 */ }
            return
          }
          json(res, err?.status ?? 500, { error: String(err?.message ?? err) })
        }
      },
    }))
  },
}
