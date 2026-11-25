// dsh-vault-desk 的扫描核心：只读文件系统，不依赖任何 Obsidian API。
// 关键点：提取 wiki-link 前必须剔除代码块与行内代码，否则 `[[...]]` 示例会被当成断链。
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, join, relative, resolve, sep } from 'node:path'

export const MD = '.md'

/** 极简 YAML frontmatter 解析：只认 key: value / key: [a, b] / key: 换行 - item。 */
export function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { data: {}, body: text, hasFrontmatter: false }
  const firstLine = text.indexOf('\n')
  if (firstLine < 0) return { data: {}, body: text, hasFrontmatter: false }
  const rest = text.slice(firstLine + 1)
  const end = rest.search(/\n---\s*(\n|$)/)
  if (end < 0) return { data: {}, body: text, hasFrontmatter: false }
  const raw = rest.slice(0, end)
  const body = rest.slice(end).replace(/^\n---\s*\n?/, '')
  const data = {}
  let currentKey = null
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = []
      data[currentKey].push(unquote(item[1].trim()))
      continue
    }
    const kv = /^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    const key = kv[1]
    const value = kv[2].trim()
    currentKey = key
    if (value === '') {
      data[key] = ''
      continue
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean)
      continue
    }
    data[key] = unquote(value)
  }
  return { data, body, hasFrontmatter: true }
}

function unquote(value) {
  const v = value.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

/** 去掉围栏代码块与行内代码，保留行号不变（用空格替换）。 */
export function stripCode(text) {
  return text
    .replace(/\`\`\`[\s\S]*?\`\`\`/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\`[^\`\n]*\`/g, (m) => ' '.repeat(m.length))
}

/** 提取 [[target]] / [[target|alias]] / [[target#heading]] 的目标与别名。 */
export function extractLinks(text) {
  const clean = stripCode(text)
  const out = []
  const re = /\[\[([^\]\|#]+)(?:#([^\]\|]*))?(?:\|([^\]]*))?\]\]/g
  let m
  while ((m = re.exec(clean))) {
    const target = m[1].replace(/\\/g, '').trim()
    if (!target) continue
    if (/\.(png|jpe?g|gif|webp|svg|pdf|mp4|emf|xlsx|csv|json|canvas|base|zip)$/i.test(target)) continue
    out.push({ target, heading: (m[2] || '').trim(), alias: (m[3] || '').trim() })
  }
  return out
}

/** 提取 markdown 链接 [text](path.md)，只关心库内 .md。 */
export function extractMdLinks(text) {
  const clean = stripCode(text)
  const out = []
  const re = /\[[^\]]*\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g
  let m
  while ((m = re.exec(clean))) out.push(decodeURIComponent(m[1]))
  return out
}

export async function readVaultFile(root, relPath) {
  const abs = safeJoin(root, relPath)
  const raw = await readFile(abs, 'utf8')
  const fm = parseFrontmatter(raw)
  return { raw, ...fm }
}

export function safeJoin(root, relPath) {
  const abs = resolve(root, relPath)
  const rootAbs = resolve(root)
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) throw Object.assign(new Error('路径越界'), { status: 400 })
  return abs
}

export function toPosix(p) {
  return p.split(sep).join('/')
}
