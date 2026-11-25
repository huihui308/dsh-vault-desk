// 扫描：遍历 md、解析链接与 frontmatter、算体检指标。
import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseFrontmatter, extractLinks, extractMdLinks, toPosix } from './vault.js'

export const DEFAULT_SETTINGS = {
  vaultPath: '/mnt/sdb1/agent/david-wiki',
  excludeFolders: ['.git', '.obsidian', '.claude', '.dsh', '.agents', '.deja', 'node_modules', 'raw', '99-附件'],
  rawFolders: ['Clippings', 'templates', '99-附件'],
  knownTopics: [
    'signal-control', 'signal-timing', 'intersection-optimization', 'communication-protocol',
    'perception', 'v2x', 'green-wave', 'traffic-detection', 'intelligent-intersection',
    'ai-agent', 'agent-architecture', 'agent-infra', 'claude', 'claude-code', 'harness',
    'loop-engineering', 'graph-engineering', 'context-engineering', 'memory-engineering',
    'rag', 'lightrag', 'mcp', 'obsidian', 'dev-tools', 'prompt-engineering', 'algorithm',
    'knowledge-management', 'short-video', 'family-health', 'pbc', 'career-strategy',
    'interview', 'beer-control', 'rknn', 'rk3588', 'deepstream', 'embedded', 'edge-ai',
    'vlm', 'computer-vision',
  ],
  largeFileKB: 200,
  staleInboxDays: 14,
}

const under = (path, prefix) => path === prefix || path.startsWith(prefix + '/')

/** 同名文件时按 Obsidian 的常识挑一个：同目录优先，其次层级最浅。 */
function pickCandidate(cands, sourcePath) {
  if (!cands || !cands.length) return null
  if (cands.length === 1) return cands[0]
  const dir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : ''
  const sameDir = cands.find((p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '') === dir)
  if (sameDir) return sameDir
  return [...cands].sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)[0]
}

async function walk(root, dir, out, excluded) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    const rel = toPosix(abs.slice(root.length + 1))
    if (entry.isDirectory()) {
      if (excluded.some((p) => under(rel, p))) continue
      await walk(root, abs, out, excluded)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.md')) out.push({ abs, rel })
  }
}

export async function scanVault(settings) {
  const started = Date.now()
  const root = settings.vaultPath
  const found = []
  await walk(root, root, found, ['.git', '.obsidian', 'node_modules'])
  const allPaths = new Set(found.map((file) => file.rel))
  const allNames = new Map()
  for (const file of found) {
    const name = basename(file.rel).replace(/\.md$/, '')
    if (!allNames.has(name)) allNames.set(name, [])
    allNames.get(name).push(file.rel)
  }
  const excluded = settings.excludeFolders.filter(Boolean)

  const docs = []
  for (const file of found) {
    if (excluded.some((prefix) => under(file.rel, prefix))) continue
    try {
      const info = await stat(file.abs)
      const raw = await import('node:fs/promises').then((fs) => fs.readFile(file.abs, 'utf8'))
      const fm = parseFrontmatter(raw)
      const links = extractLinks(raw)
      const mdLinks = extractMdLinks(raw)
      const tags = new Set()
      const fmTags = fm.data.tags
      if (Array.isArray(fmTags)) fmTags.forEach((t) => typeof t === 'string' && tags.add(t.replace(/^#/, '')))
      else if (typeof fmTags === 'string') tags.add(fmTags.replace(/^#/, ''))
      const inline = raw.match(/(^|\s)#([A-Za-z0-9_\-\/]+)/g) || []
      inline.forEach((t) => tags.add(t.trim().replace(/^#/, '')))
      docs.push({
        path: file.rel, abs: file.abs, name: basename(file.rel).replace(/\.md$/, ''), size: info.size, mtime: info.mtimeMs,
        frontmatter: fm.data, body: fm.body, links, mdLinks, tags: [...tags],
      })
    } catch { /* 单个文件读失败不影响全局 */ }
  }

  const dangling = []
  const inbound = new Map()
  for (const doc of docs) {
    for (const link of doc.links) {
      const target = link.target
      let hit = null
      if (target.includes('/')) {
        const guess = target.replace(/^\/+/, '')
        if (allPaths.has(guess)) hit = guess
        else if (allPaths.has(guess + '.md')) hit = guess + '.md'
        else {
          const tail = guess.split('/').pop().replace(/\.md$/, '')
          hit = pickCandidate(allNames.get(tail), doc.path)
        }
      } else {
        hit = pickCandidate(allNames.get(target.replace(/\.md$/, '')), doc.path)
      }
      if (!hit) dangling.push({ source: doc.path, target, heading: link.heading })
      else inbound.set(hit, (inbound.get(hit) || 0) + 1)
    }
    for (const target of doc.mdLinks) {
      const guess = target.replace(/^\.\//, '').replace(/^\/+/, '')
      if (!allPaths.has(guess)) dangling.push({ source: doc.path, target, heading: '' })
      else inbound.set(guess, (inbound.get(guess) || 0) + 1)
    }
  }
  const byName = new Map()
  for (const doc of docs) {
    if (!byName.has(doc.name)) byName.set(doc.name, [])
    byName.get(doc.name).push(doc)
  }

  const isRaw = (p) => settings.rawFolders.filter(Boolean).some((x) => under(p, x))
  const issues = []
  const counts = {}
  const add = (kind, severity, path, detail, target) => {
    issues.push({ kind, severity, path, detail, target })
    counts[kind] = (counts[kind] || 0) + 1
  }

  for (const d of dangling) add('dangling-link', 'error', d.source, '指向不存在的笔记：' + d.target, d.target)

  const orphans = []
  for (const doc of docs) {
    if (isRaw(doc.path)) continue
    if (doc.path.startsWith('Inbox/')) continue
    if (doc.name.startsWith('MOC-')) continue
    if (doc.frontmatter.type === 'moc' || doc.frontmatter.doc_type === 'index') continue
    if (inbound.get(doc.path)) continue
    orphans.push(doc.path)
    add('orphan', 'warn', doc.path, '没有任何笔记链接到它')
  }

  const byType = new Map()
  const byTag = new Map()
  const known = new Set(settings.knownTopics)
  for (const doc of docs) {
    const type = typeof doc.frontmatter.type === 'string' ? doc.frontmatter.type : ''
    if (type) byType.set(type, (byType.get(type) || 0) + 1)
    for (const tag of doc.tags) byTag.set(tag, (byTag.get(tag) || 0) + 1)
    if (isRaw(doc.path)) continue
    if (!type) add('missing-type', 'warn', doc.path, 'frontmatter 缺 type')
    if (!doc.tags.length) add('missing-tags', 'warn', doc.path, 'frontmatter 缺 tags')
    if (!doc.frontmatter.description && !doc.frontmatter.summary) {
      add('missing-description', 'warn', doc.path, 'frontmatter 缺 description（检索摘要层）')
    }
    for (const tag of doc.tags) {
      if (!tag.startsWith('topic/')) continue
      const value = tag.slice(6)
      if (known.size && !known.has(value)) add('tag-longtail', 'info', doc.path, 'topic 取值不在收敛表：' + tag, tag)
    }
  }

  const uncompiled = []
  for (const doc of docs) {
    const isClip = doc.path.startsWith('Clippings/') || doc.frontmatter.type === 'clippings'
    if (!isClip) continue
    if (doc.frontmatter.compiled === 'true' || doc.frontmatter.compiled === true) continue
    if (Array.isArray(doc.frontmatter.compiled_to)) continue
    uncompiled.push(doc.path)
    add('uncompiled-clipping', 'info', doc.path, '外部剪藏尚未编译进笔记区')
  }

  const largeFiles = []
  if (settings.largeFileKB > 0) {
    for (const doc of docs) {
      if (doc.size <= settings.largeFileKB * 1024) continue
      largeFiles.push(doc.path)
      add('large-file', 'info', doc.path, '超过 ' + settings.largeFileKB + ' KB，考虑拆分')
    }
  }

  const duplicateNames = []
  for (const [name, list] of byName) {
    if (list.length < 2) continue
    duplicateNames.push({ name, paths: list.map((d) => d.path) })
    for (const d of list) add('duplicate-name', 'info', d.path, '同名笔记 ' + list.length + ' 篇，裸链接会歧义', name)
  }

  if (settings.staleInboxDays > 0) {
    const cutoff = Date.now() - settings.staleInboxDays * 86400000
    for (const doc of docs) {
      if (!doc.path.startsWith('Inbox/')) continue
      if (doc.mtime > cutoff) continue
      add('stale-inbox', 'info', doc.path, 'Inbox 停留超过 ' + settings.staleInboxDays + ' 天')
    }
  }

  const tree = { path: '', name: '/', files: 0, totalFiles: 0, bytes: 0, children: [] }
  const index = new Map([['', tree]])
  for (const doc of docs) {
    const parts = doc.path.split('/')
    parts.pop()
    let parent = ''
    for (const part of parts) {
      const path = parent ? parent + '/' + part : part
      if (!index.has(path)) {
        const node = { path, name: part, files: 0, totalFiles: 0, bytes: 0, children: [] }
        index.set(path, node)
        index.get(parent).children.push(node)
      }
      parent = path
    }
    const node = index.get(parent)
    node.files += 1
    node.bytes += doc.size
  }
  const finalize = (node) => {
    let total = node.files
    for (const child of node.children) total += finalize(child)
    node.totalFiles = total
    node.children.sort((a, b) => b.totalFiles - a.totalFiles || a.name.localeCompare(b.name))
    return total
  }
  finalize(tree)

  const sorted = [...docs].sort((a, b) => b.mtime - a.mtime)
  return {
    scannedAt: Date.now(),
    durationMs: Date.now() - started,
    root,
    totalFiles: docs.length,
    totalBytes: docs.reduce((s, d) => s + d.size, 0),
    files: docs.map((d) => ({ path: d.path, size: d.size, mtime: d.mtime, type: d.frontmatter.type || '', description: d.frontmatter.description || '' })),
    issues,
    counts,
    dangling,
    orphans,
    uncompiled,
    largeFiles,
    duplicateNames,
    tree,
    byType: [...byType].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byTag: [...byTag].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    recent: sorted.slice(0, 20).map((d) => ({ path: d.path, mtime: d.mtime })),
  }
}
