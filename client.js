// dsh-vault-desk 的浏览器半片：库工作台面板（总览 / 体检 / 文件 / 移动）。
window.__ModuleLoader__.load({
  id: 'dsh-vault-desk',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useState } = React

    const API = '/vault-desk'
    const MAIN_KEY = 'vault-desk'
    const PANEL_ID = 'vault-desk'
    const TABS = [['overview', '总览'], ['health', '体检'], ['files', '文件'], ['move', '移动']]
    const KIND_LABEL = {
      'dangling-link': '断链', orphan: '孤儿', 'missing-description': '缺摘要', 'missing-type': '缺 type',
      'missing-tags': '缺标签', 'tag-longtail': '标签长尾', 'uncompiled-clipping': '未编译剪藏',
      'large-file': '大文件', 'duplicate-name': '同名笔记', 'stale-inbox': 'Inbox 积压',
    }
    const SEV_LABEL = { error: '错误', warn: '警告', info: '提示' }

    const STYLE = [
      '.vb-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px}',
      '.vb-head{display:flex;align-items:flex-start;gap:12px;padding:14px 18px 0}',
      '.vb-head-main{flex:1;min-width:0}',
      '.vb-title{font-size:16px;font-weight:650;margin:0;line-height:1.3}',
      '.vb-sub{color:var(--dsw-alias-label-tertiary);font-size:11.5px;margin-top:3px}',
      '.vb-actions{display:flex;gap:6px;flex-wrap:wrap}',
      '.vb-btn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:7px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}',
      '.vb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.vb-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.vb-btn[data-kind="primary"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}',
      '.vb-btn[data-kind="ghost"]{border-color:transparent;background:transparent}',
      '.vb-tabs{display:flex;gap:2px;padding:8px 18px 0;border-bottom:1px solid var(--dsw-alias-border-l1);margin-top:2px}',
      '.vb-tab{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12.5px;padding:7px 13px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}',
      '.vb-tab:hover{color:var(--dsw-alias-label-primary)}',
      '.vb-tab[data-on="1"]{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.vb-body{flex:1;min-height:0;overflow:auto;padding:14px 18px 24px}',
      '.vb-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin-bottom:14px}',
      '.vb-card{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:9px 11px;border-left:3px solid var(--dsw-alias-border-l2)}',
      '.vb-card[data-tone="danger"]{border-left-color:var(--dsw-alias-state-error-primary)}',
      '.vb-card[data-tone="warn"]{border-left-color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-brand-primary))}',
      '.vb-card[data-tone="ok"]{border-left-color:var(--dsw-alias-state-success-primary)}',
      '.vb-card-value{font-size:17px;font-weight:650;line-height:1.2}',
      '.vb-card-label{color:var(--dsw-alias-label-tertiary);font-size:10.5px;margin-top:3px}',
      '.vb-section{margin:16px 0 8px}',
      '.vb-section h3{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);margin:0 0 7px}',
      '.vb-tree{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:6px 9px}',
      '.vb-tree details{margin:1px 0}',
      '.vb-tree summary{cursor:pointer;display:flex;gap:8px;align-items:center;padding:3px 4px;border-radius:4px;list-style:none}',
      '.vb-tree summary::-webkit-details-marker{display:none}',
      '.vb-tree summary:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.vb-tree-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.vb-tree-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap}',
      '.vb-bar-row{display:flex;align-items:center;gap:8px;margin:3px 0}',
      '.vb-bar-label{width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}',
      '.vb-bar-track{flex:1;height:7px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}',
      '.vb-bar-fill{height:100%;border-radius:4px;background:var(--dsw-alias-brand-primary)}',
      '.vb-bar-value{width:34px;text-align:right;color:var(--dsw-alias-label-tertiary);font-size:11px}',
      '.vb-controls{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}',
      '.vb-select,.vb-input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;padding:5px 8px;font:inherit;font-size:12px}',
      '.vb-select option,.vb-select optgroup{background-color:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.vb-input{flex:1;min-width:150px}',
      '.vb-summary{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-left:auto}',
      '.vb-list{display:flex;flex-direction:column;gap:5px}',
      '.vb-issue{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:7px 9px;cursor:pointer}',
      '.vb-issue[data-sev="error"]{border-left-color:var(--dsw-alias-state-error-primary)}',
      '.vb-issue[data-sev="warn"]{border-left-color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-brand-primary))}',
      '.vb-issue:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.vb-issue-head{display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
      '.vb-badge{font-size:10px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.vb-issue-kind{color:var(--dsw-alias-label-tertiary);font-size:11px}',
      '.vb-issue-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.vb-issue-detail{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-top:2px;word-break:break-all}',
      '.vb-split{display:grid;grid-template-columns:minmax(240px,38%) 1fr;gap:12px;align-items:start;min-height:0}',
      '.vb-pane{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:9px;min-width:0}',
      '.vb-rows{max-height:58vh;overflow:auto}',
      '.vb-row{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:4px 6px;border-radius:4px;cursor:pointer}',
      '.vb-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.vb-row[data-on="1"]{background:var(--dsw-alias-interactive-bg-hover)}',
      '.vb-row-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}',
      '.vb-row-meta{color:var(--dsw-alias-label-tertiary);font-size:10.5px;white-space:nowrap}',
      '.vb-editor{width:100%;box-sizing:border-box;min-height:46vh;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:9px;font:12px/1.55 var(--dsw-font-mono,monospace)}',
      '.vb-file-head{display:flex;gap:8px;align-items:center;margin-bottom:7px}',
      '.vb-file-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}',
      '.vb-status{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.vb-status[data-error="1"]{color:var(--dsw-alias-state-error-primary)}',
      '.vb-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}',
      '.vb-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.vb-note{color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:1.5}',
      '.vb-note[data-error="1"]{color:var(--dsw-alias-state-error-primary)}',
      '.vb-empty{padding:40px 8px;text-align:center;color:var(--dsw-alias-label-tertiary)}',
      '.vb-move-path{font-family:var(--dsw-font-mono,monospace);font-size:11.5px;word-break:break-all}',
    ].join('\n')

    async function getJSON(path) {
      const res = await fetch(API + path, { headers: { accept: 'application/json' } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'HTTP ' + res.status)
      return body
    }
    async function postJSON(path, payload) {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'HTTP ' + res.status)
      return body
    }
    const fmtBytes = (n) => {
      if (!n) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let v = n
      let i = 0
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
      return (i ? v.toFixed(1) : Math.round(v)) + ' ' + units[i]
    }
    const fmtTime = (ts) => {
      if (!ts) return '—'
      const diff = Date.now() - ts
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
      return Math.floor(diff / 86400000) + ' 天前'
    }

    function Icon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('rect', { x: 3, y: 3, width: 7, height: 7, rx: 1.2 }),
        h('rect', { x: 14, y: 3, width: 7, height: 7, rx: 1.2 }),
        h('rect', { x: 3, y: 14, width: 7, height: 7, rx: 1.2 }),
        h('path', { d: 'M14 17.5h7M17.5 14v7' }))
    }

    function Stat({ label, value, tone }) {
      return h('div', { className: 'vb-card', 'data-tone': tone || '' },
        h('div', { className: 'vb-card-value' }, String(value)),
        h('div', { className: 'vb-card-label' }, label))
    }

    function Tree({ node, depth }) {
      if (!node || !node.children.length) return null
      return h('div', null, node.children.map(child => h('details', { key: child.path, open: depth === 0 },
        h('summary', null,
          h('span', { className: 'vb-tree-name' }, child.name),
          h('span', { className: 'vb-tree-meta' }, child.totalFiles + ' 篇 · ' + fmtBytes(child.bytes))),
        h(Tree, { node: child, depth: depth + 1 }))))
    }

    function BarRows({ rows, labelKey }) {
      const max = Math.max(1, ...rows.map(r => r.count))
      return h('div', null, rows.map(row => h('div', { className: 'vb-bar-row', key: row[labelKey] },
        h('span', { className: 'vb-bar-label' }, row[labelKey] || '(空)'),
        h('div', { className: 'vb-bar-track' }, h('div', { className: 'vb-bar-fill', style: { width: Math.round(row.count / max * 100) + '%' } })),
        h('span', { className: 'vb-bar-value' }, String(row.count)))))
    }

    function Overview({ scan }) {
      if (!scan) return h('div', { className: 'vb-empty' }, '正在扫描…')
      const c = scan.counts || {}
      return h('div', null,
        h('div', { className: 'vb-cards' },
          h(Stat, { label: '笔记', value: scan.totalFiles }),
          h(Stat, { label: '总大小', value: fmtBytes(scan.totalBytes) }),
          h(Stat, { label: '断链', value: c['dangling-link'] || 0, tone: c['dangling-link'] ? 'danger' : 'ok' }),
          h(Stat, { label: '孤儿', value: c.orphan || 0, tone: c.orphan ? 'warn' : 'ok' }),
          h(Stat, { label: '缺摘要', value: c['missing-description'] || 0, tone: 'warn' }),
          h(Stat, { label: '未编译剪藏', value: c['uncompiled-clipping'] || 0 }),
          h(Stat, { label: '大文件', value: c['large-file'] || 0 }),
          h(Stat, { label: '同名', value: (scan.duplicateNames || []).length })),
        h('div', { className: 'vb-section' }, h('h3', null, '目录结构'), h('div', { className: 'vb-tree' }, h(Tree, { node: scan.tree, depth: 0 }))),
        h('div', { className: 'vb-section' }, h('h3', null, '类型分布'), h(BarRows, { rows: (scan.byType || []).slice(0, 12), labelKey: 'type' })),
        h('div', { className: 'vb-section' }, h('h3', null, '标签 Top 12'), h(BarRows, { rows: (scan.byTag || []).slice(0, 12), labelKey: 'tag' })))
    }

    function Health({ scan, onOpen }) {
      const [kind, setKind] = useState('all')
      const [sev, setSev] = useState('all')
      const [query, setQuery] = useState('')
      const issues = scan ? scan.issues : []
      const kinds = useMemo(() => {
        const map = new Map()
        issues.forEach(i => map.set(i.kind, (map.get(i.kind) || 0) + 1))
        return [...map.entries()].sort((a, b) => b[1] - a[1])
      }, [issues])
      const filtered = useMemo(() => issues.filter(i =>
        (kind === 'all' || i.kind === kind) &&
        (sev === 'all' || i.severity === sev) &&
        (!query || (i.path + ' ' + i.detail + ' ' + (i.target || '')).toLowerCase().includes(query.toLowerCase()))
      ), [issues, kind, sev, query])
      if (!scan) return h('div', { className: 'vb-empty' }, '正在扫描…')
      return h('div', null,
        h('div', { className: 'vb-controls' },
          h('select', { className: 'vb-select', value: kind, onChange: e => setKind(e.target.value) },
            h('option', { value: 'all' }, '全部类别'),
            kinds.map(([k, n]) => h('option', { key: k, value: k }, (KIND_LABEL[k] || k) + '（' + n + '）'))),
          h('select', { className: 'vb-select', value: sev, onChange: e => setSev(e.target.value) },
            h('option', { value: 'all' }, '全部级别'),
            ['error', 'warn', 'info'].map(s => h('option', { key: s, value: s }, SEV_LABEL[s]))),
          h('input', { className: 'vb-input', placeholder: '按路径 / 详情筛选', value: query, onChange: e => setQuery(e.target.value) }),
          h('span', { className: 'vb-summary' }, '匹配 ' + filtered.length + ' / ' + issues.length)),
        h('div', { className: 'vb-list' }, filtered.slice(0, 800).map((issue, idx) =>
          h('div', { key: idx, className: 'vb-issue', 'data-sev': issue.severity, onClick: () => onOpen(issue.path) },
            h('div', { className: 'vb-issue-head' },
              h('span', { className: 'vb-badge' }, SEV_LABEL[issue.severity] || issue.severity),
              h('span', { className: 'vb-issue-kind' }, KIND_LABEL[issue.kind] || issue.kind),
              h('span', { className: 'vb-issue-path' }, issue.path)),
            h('div', { className: 'vb-issue-detail' }, issue.detail)))))
    }

    function Files({ scan, openPath, onConsumed }) {
      const [query, setQuery] = useState('')
      const [selected, setSelected] = useState('')
      const [content, setContent] = useState('')
      const [original, setOriginal] = useState('')
      const [status, setStatus] = useState('')
      const [err, setErr] = useState(false)
      const [busy, setBusy] = useState(false)

      useEffect(() => {
        if (openPath) {
          setSelected(openPath)
          if (onConsumed) onConsumed()
        }
      }, [openPath])

      useEffect(() => {
        if (!selected) return
        let alive = true
        setStatus('加载中…'); setErr(false)
        getJSON('/file?path=' + encodeURIComponent(selected))
          .then(r => { if (!alive) return; setContent(r.content); setOriginal(r.content); setStatus('') })
          .catch(e => { if (!alive) return; setErr(true); setStatus('读取失败：' + e.message) })
        return () => { alive = false }
      }, [selected])

      const files = scan ? scan.files : []
      const filtered = query ? files.filter(f => f.path.toLowerCase().includes(query.toLowerCase())) : files
      const dirty = content !== original

      const save = async () => {
        if (!selected) return
        setBusy(true); setErr(false); setStatus('保存中…')
        try {
          await postJSON('/file', { path: selected, content })
          setOriginal(content)
          setStatus('已保存 ' + new Date().toLocaleTimeString())
        } catch (e) {
          setErr(true); setStatus('保存失败：' + e.message)
        } finally { setBusy(false) }
      }

      return h('div', { className: 'vb-split' },
        h('div', { className: 'vb-pane' },
          h('input', { className: 'vb-input', style: { width: '100%', marginBottom: '6px' }, placeholder: '搜索文件名 / 路径', value: query, onChange: e => setQuery(e.target.value) }),
          h('div', { className: 'vb-status', style: { marginBottom: '6px' } }, filtered.length + ' / ' + files.length + ' 篇'),
          h('div', { className: 'vb-rows' }, filtered.slice(0, 500).map(f =>
            h('div', { key: f.path, className: 'vb-row', 'data-on': f.path === selected ? '1' : '0', onClick: () => setSelected(f.path) },
              h('span', { className: 'vb-row-path' }, f.path),
              h('span', { className: 'vb-row-meta' }, fmtBytes(f.size)))))),
        h('div', { className: 'vb-pane' },
          selected
            ? h('div', null,
              h('div', { className: 'vb-file-head' },
                h('span', { className: 'vb-file-path' }, selected),
                dirty ? h('span', { className: 'vb-badge' }, '未保存') : null,
                h('button', { className: 'vb-btn', 'data-kind': 'primary', onClick: save, disabled: busy || !dirty }, busy ? '保存中…' : '保存')),
              h('textarea', { className: 'vb-editor', value: content, onChange: e => setContent(e.target.value) }),
              h('div', { className: 'vb-status', 'data-error': err ? '1' : '0' }, status))
            : h('div', { className: 'vb-empty' }, '从左侧选一个文件查看和编辑')))
    }

    function Move({ scan, onMoved }) {
      const [query, setQuery] = useState('')
      const [selected, setSelected] = useState('')
      const [folders, setFolders] = useState([])
      const [dest, setDest] = useState('')
      const [status, setStatus] = useState('')
      const [err, setErr] = useState(false)
      const [busy, setBusy] = useState(false)
      const [last, setLast] = useState(null)

      useEffect(() => {
        getJSON('/folders').then(r => setFolders(r.folders || [])).catch(() => undefined)
      }, [])

      const files = scan ? scan.files : []
      const filtered = query ? files.filter(f => f.path.toLowerCase().includes(query.toLowerCase())) : files
      const name = selected ? selected.split('/').pop() : ''
      const target = selected ? (dest ? dest + '/' + name : name) : ''
      const same = target === selected

      const run = async () => {
        if (!selected) return
        setBusy(true); setErr(false); setStatus('移动中…')
        try {
          const result = await postJSON('/move', { path: selected, dest })
          setLast(result)
          setStatus('已移动，重写引用 ' + (result.rewritten ? result.rewritten.length : 0) + ' 个文件')
          setSelected('')
          if (onMoved) await onMoved()
        } catch (e) {
          setErr(true); setStatus('移动失败：' + e.message)
        } finally { setBusy(false) }
      }

      return h('div', { className: 'vb-split' },
        h('div', { className: 'vb-pane' },
          h('div', { className: 'vb-label', style: { marginBottom: '5px' } }, '选择要移动的文件'),
          h('input', { className: 'vb-input', style: { width: '100%', marginBottom: '6px' }, placeholder: '搜索文件名 / 路径', value: query, onChange: e => setQuery(e.target.value) }),
          h('div', { className: 'vb-rows' }, filtered.slice(0, 500).map(f =>
            h('div', { key: f.path, className: 'vb-row', 'data-on': f.path === selected ? '1' : '0', onClick: () => { setSelected(f.path); setDest((f.path.split('/').slice(0, -1).join('/'))) } },
              h('span', { className: 'vb-row-path' }, f.path))))),
        h('div', { className: 'vb-pane' },
          h('div', { className: 'vb-field' },
            h('span', { className: 'vb-label' }, '当前路径'),
            h('div', { className: 'vb-move-path' }, selected || '—')),
          h('div', { className: 'vb-field' },
            h('span', { className: 'vb-label' }, '目标目录'),
            h('select', { className: 'vb-select', value: dest, onChange: e => setDest(e.target.value) },
              h('option', { value: '' }, '(库根)'),
              folders.map(f => h('option', { key: f, value: f }, f || '/'))),
          h('div', { className: 'vb-field' },
            h('span', { className: 'vb-label' }, '新路径'),
            h('div', { className: 'vb-move-path' }, target || '—')),
          h('div', { className: 'vb-note', style: { marginBottom: '10px' } },
            selected
              ? (same ? '目标与当前相同。' : '移动后会重写所有带路径的 [[链接]] 与 [](路径) 引用；裸名链接按文件名解析，不受影响。')
              : '先在左侧选一个文件。'),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('button', { className: 'vb-btn', 'data-kind': 'primary', onClick: run, disabled: busy || !selected || same }, busy ? '移动中…' : '移动到该目录'),
            h('span', { className: 'vb-status', 'data-error': err ? '1' : '0' }, status)),
          last ? h('div', { className: 'vb-note', style: { marginTop: '10px' } }, '已移动：' + last.from + ' → ' + last.to) : null,
          last && last.rewritten && last.rewritten.length
            ? h('div', { className: 'vb-note' }, '重写引用的文件：' + last.rewritten.join('、'))
            : null)))
    }

    function App() {
      const [scan, setScan] = useState(null)
      const [tab, setTab] = useState('overview')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [openPath, setOpenPath] = useState('')

      const rescan = useCallback(async () => {
        setBusy(true); setError('')
        try {
          const data = await getJSON('/scan')
          setScan(data)
        } catch (e) {
          setError(e.message)
        } finally { setBusy(false) }
      }, [])

      useEffect(() => { rescan() }, [rescan])

      const openFile = useCallback((path) => {
        setOpenPath(path)
        setTab('files')
      }, [])

      const sub = scan
        ? scan.totalFiles + ' 篇 · ' + scan.issues.length + ' 个问题 · 扫描耗时 ' + scan.durationMs + ' ms'
        : (error ? '扫描失败：' + error : '正在扫描…')

      const body =
        tab === 'overview' ? h(Overview, { scan }) :
        tab === 'health' ? h(Health, { scan, onOpen: openFile }) :
        tab === 'files' ? h(Files, { scan, openPath, onConsumed: () => setOpenPath('') }) :
        h(Move, { scan, onMoved: rescan })

      return h('div', { className: 'vb-root' },
        h('style', null, STYLE),
        h('div', { className: 'vb-head' },
          h('div', { className: 'vb-head-main' },
            h('h1', { className: 'vb-title' }, '库工作台'),
            h('div', { className: 'vb-sub' }, sub)),
          h('div', { className: 'vb-actions' },
            h('button', { className: 'vb-btn', onClick: rescan, disabled: busy }, busy ? '扫描中…' : '重新扫描'),
            h('button', { className: 'vb-btn', 'data-kind': 'ghost', onClick: async () => {
              try {
                const r = await postJSON('/report', {})
                setError('')
                alert('报告已写入：' + r.path)
              } catch (e) { setError('导出失败：' + e.message) }
            } }, '导出报告'))),
        h('div', { className: 'vb-tabs' }, TABS.map(([id, label]) =>
          h('button', { key: id, className: 'vb-tab', 'data-on': tab === id ? '1' : '0', onClick: () => setTab(id) }, label))),
        h('div', { className: 'vb-body' }, body))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: MAIN_KEY }, App))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 9,
          label: () => '库工作台',
        }, () => h(Icon, { size: 16 })))
      },
    }
  },
})
