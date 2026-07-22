import type { CompareNode, CompareResult, DiffStatus } from './types'

const STATUS_LABEL: Record<DiffStatus, string> = {
  identical: 'Identical',
  different: 'Different',
  leftOnly: 'Left only',
  rightOnly: 'Right only'
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
}

function fmtSize(n: number | undefined): string {
  if (n === undefined) return ''
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}

/** Collect every changed (non-identical) file node, depth-first. */
export function collectChangedFiles(result: CompareResult): CompareNode[] {
  const changed: CompareNode[] = []
  const visit = (node: CompareNode): void => {
    for (const child of node.children ?? []) {
      if (child.kind === 'file' && child.status !== 'identical') changed.push(child)
      if (child.children) visit(child)
    }
  }
  visit(result.root)
  return changed
}

/** Quote a value for CSV (RFC 4180) when it contains a comma, quote or newline. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Generate a CSV of the changed files in a folder comparison. Pure. */
export function toCsvReport(result: CompareResult): string {
  const header = ['Path', 'Status', 'Left size', 'Right size']
  const rows = collectChangedFiles(result).map((n) =>
    [n.relPath, STATUS_LABEL[n.status], n.left?.size ?? '', n.right?.size ?? '']
      .map((c) => csvCell(String(c)))
      .join(',')
  )
  return [header.join(','), ...rows].join('\r\n')
}

/** Generate a self-contained HTML report of a folder comparison. Pure. */
export function toHtmlReport(result: CompareResult): string {
  const changed = collectChangedFiles(result)

  const s = result.summary
  const rows = changed
    .map(
      (n) =>
        `<tr class="${n.status}"><td>${esc(n.relPath)}</td><td>${STATUS_LABEL[n.status]}</td>` +
        `<td class="num">${fmtSize(n.left?.size)}</td><td class="num">${fmtSize(n.right?.size)}</td></tr>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Juxta comparison report</title>
<style>
 body{font-family:Segoe UI,system-ui,sans-serif;margin:24px;color:#1f1f1f}
 h1{font-size:18px} .roots{color:#555;font-size:13px}
 table{border-collapse:collapse;margin-top:16px;width:100%;font-size:13px}
 th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}
 td.num{text-align:right;font-variant-numeric:tabular-nums}
 tr.different{background:#fff7e6} tr.leftOnly{background:#eaf6ec} tr.rightOnly{background:#fdecea}
 .summary span{margin-right:16px}
</style></head><body>
<h1>Juxta comparison report</h1>
<div class="roots"><div>Left: ${esc(result.leftRoot)}</div><div>Right: ${esc(result.rightRoot)}</div></div>
<p class="summary">
 <span>${s.different} different</span><span>${s.leftOnly} left only</span>
 <span>${s.rightOnly} right only</span><span>${s.moved} moved</span>
 <span>${s.identical} identical</span><span>${s.totalFiles} files</span>
</p>
<table><thead><tr><th>Path</th><th>Status</th><th>Left size</th><th>Right size</th></tr></thead>
<tbody>
${rows}
</tbody></table>
</body></html>
`
}
