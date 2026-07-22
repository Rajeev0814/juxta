import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CompareNode, CompareResult, DiffStatus, Side } from '../../../shared/types'
import { ancestorsOf, collectDirRelPaths } from '../../../shared/nav'
import { churnByDir, type Churn } from '../../../shared/churn'
import { defaultExpanded, flatten, formatSize, formatTime, statusClass } from '../lib/treeUtils'

/** Green→red heat colour for a change ratio in [0, 1]. */
function heatColor(ratio: number): string {
  return `hsl(${Math.round((1 - ratio) * 120)}, 65%, 45%)`
}

const ROW_H = 24
const OVERSCAN = 12

interface Props {
  result: CompareResult
  hideIdentical: boolean
  /** Categories (different/leftOnly/rightOnly) hidden by the status-bar filter chips. */
  hiddenStatuses?: ReadonlySet<DiffStatus>
  selectedRelPath: string | null
  /** When set, expand ancestors and scroll this relPath into view. */
  reveal: { relPath: string; nonce: number } | null
  /** Expand-all / collapse-all / restore-default command. */
  expandSignal?: { mode: 'all' | 'none' | 'default'; nonce: number } | null
  onSelect: (node: CompareNode) => void
  onOpenFile: (node: CompareNode) => void
  onCopy: (node: CompareNode, direction: Side) => void
  onDelete: (node: CompareNode, side: Side) => void
  onCopyTime: (node: CompareNode, direction: Side) => void
  /** Hide merge/delete/timestamp actions (e.g. archive contents). */
  readOnly?: boolean
  /** Right-click on a side: pop up Show-in-Explorer / Copy-path for that path. */
  onContextMenu?: (path: string) => void
}

export function TwoPaneTree(props: Props): React.JSX.Element {
  const { result } = props
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded(result.root))
  const [nameFilter, setNameFilter] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)
  const scrollerRef = useRef<HTMLDivElement>(null)

  // Recompute the auto-expanded set whenever a fresh comparison arrives.
  useEffect(() => {
    setExpanded(defaultExpanded(result.root))
  }, [result])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    setViewportH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const rows = useMemo(
    () => flatten(result.root, expanded, props.hideIdentical, nameFilter, props.hiddenStatuses),
    [result, expanded, props.hideIdentical, nameFilter, props.hiddenStatuses]
  )

  // Per-directory change density (folder churn heatmap).
  const churn = useMemo(() => churnByDir(result.root), [result])

  // Reveal a target row: expand its ancestors and scroll it to center.
  const reveal = props.reveal
  useEffect(() => {
    if (!reveal) return
    const next = new Set(expanded)
    for (const a of ancestorsOf(reveal.relPath)) next.add(a)
    setExpanded(next)
    const freshRows = flatten(result.root, next, props.hideIdentical, nameFilter, props.hiddenStatuses)
    const idx = freshRows.findIndex((r) => r.node.relPath === reveal.relPath)
    const scroller = scrollerRef.current
    if (idx >= 0 && scroller) {
      scroller.scrollTop = Math.max(0, idx * ROW_H - scroller.clientHeight / 2 + ROW_H)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal])

  // Expand-all / collapse-all / restore-default.
  const expandSignal = props.expandSignal
  useEffect(() => {
    if (!expandSignal) return
    if (expandSignal.mode === 'all') setExpanded(new Set(collectDirRelPaths(result.root)))
    else if (expandSignal.mode === 'none') setExpanded(new Set())
    else setExpanded(defaultExpanded(result.root))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandSignal])

  const total = rows.length
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const visibleCount = Math.ceil(viewportH / ROW_H) + OVERSCAN * 2
  const end = Math.min(total, start + visibleCount)
  const slice = rows.slice(start, end)

  const toggle = (relPath: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(relPath)) next.delete(relPath)
      else next.add(relPath)
      return next
    })
  }

  return (
    <div className="tree">
      <div className="tree-filter-bar">
        <input
          className="tree-filter"
          type="text"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Filter by file name…"
          spellCheck={false}
        />
        {nameFilter.trim() && (
          <button className="tree-filter-clear" onClick={() => setNameFilter('')} title="Clear filter">
            ✕
          </button>
        )}
      </div>
      <div className="tree-header">
        <div className="pane-title left" title={result.leftRoot}>
          {result.leftRoot}
        </div>
        <div className="gutter-title" />
        <div className="pane-title right" title={result.rightRoot}>
          {result.rightRoot}
        </div>
      </div>

      <div
        className="tree-body"
        ref={scrollerRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: total * ROW_H, position: 'relative' }}>
          <div style={{ transform: `translateY(${start * ROW_H}px)` }}>
            {slice.map((row) => (
              <TreeRow
                key={row.node.relPath}
                row={row}
                churn={row.node.kind === 'directory' ? churn.get(row.node.relPath) : undefined}
                selected={props.selectedRelPath === row.node.relPath}
                onToggle={toggle}
                onSelect={props.onSelect}
                onOpenFile={props.onOpenFile}
                onCopy={props.onCopy}
                onDelete={props.onDelete}
                onCopyTime={props.onCopyTime}
                readOnly={props.readOnly}
                onContextMenu={props.onContextMenu}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  row: ReturnType<typeof flatten>[number]
  churn?: Churn
  selected: boolean
  onToggle: (relPath: string) => void
  onSelect: (node: CompareNode) => void
  onOpenFile: (node: CompareNode) => void
  onCopy: (node: CompareNode, direction: Side) => void
  onDelete: (node: CompareNode, side: Side) => void
  onCopyTime: (node: CompareNode, direction: Side) => void
  readOnly?: boolean
  onContextMenu?: (path: string) => void
}

function TreeRow({ row, churn, selected, onToggle, onSelect, onOpenFile, onCopy, onDelete, onCopyTime, readOnly, onContextMenu }: RowProps): React.JSX.Element {
  const { node, depth, hasChildren, expanded } = row
  const isDir = node.kind === 'directory'

  const onRowClick = (): void => {
    onSelect(node)
    if (isDir && hasChildren) onToggle(node.relPath)
    else if (!isDir) onOpenFile(node)
  }

  const indent = depth * 14
  const cls = statusClass(node.status)

  const chevron = isDir && hasChildren ? (expanded ? '▾' : '▸') : ''
  const icon = isDir ? '📁' : '📄'

  return (
    <div
      className={`tree-row ${cls}${selected ? ' selected' : ''}`}
      style={{ height: ROW_H }}
      onClick={onRowClick}
      onDoubleClick={() => !isDir && onOpenFile(node)}
    >
      {/* Left side */}
      <div
        className={`pane-cell left ${node.left ? '' : 'absent'}`}
        onContextMenu={(e) => {
          if (node.left && onContextMenu) {
            e.preventDefault()
            onContextMenu(node.left.path)
          }
        }}
      >
        <span className="indent" style={{ width: indent }} />
        <span className="chevron">{chevron}</span>
        {node.left ? (
          <>
            <span className="icon">{icon}</span>
            <span className="name">{node.name}</span>
            {node.movedTo && (
              <span className="moved" title={`Renamed/moved to ${node.movedTo}`}>⇄</span>
            )}
            {node.kind === 'file' && (
              <span className="meta">
                {formatSize(node.left.size)} · {formatTime(node.left.mtimeMs)}
                {node.newer === 'left' && <span className="newer"> ●newer</span>}
              </span>
            )}
            {isDir && churn && churn.total > 0 && (
              <span
                className="churn"
                title={`${churn.changed} of ${churn.total} files changed (${Math.round(churn.ratio * 100)}%)`}
              >
                <span className="churn-bar">
                  <span
                    className="churn-fill"
                    style={{ width: `${churn.ratio * 100}%`, background: heatColor(churn.ratio) }}
                  />
                </span>
                <span className="churn-pct">{Math.round(churn.ratio * 100)}%</span>
              </span>
            )}
          </>
        ) : null}
      </div>

      {/* Center action gutter */}
      <div className="gutter" onClick={(e) => e.stopPropagation()}>
        {!readOnly && node.left && (
          <button className="act" title="Copy to right →" onClick={() => onCopy(node, 'left')}>
            →
          </button>
        )}
        {!readOnly && node.right && (
          <button className="act" title="← Copy to left" onClick={() => onCopy(node, 'right')}>
            ←
          </button>
        )}
        {!readOnly && node.kind === 'file' && node.left && node.right && node.status === 'different' && (
          <>
            <button className="act" title="Copy left's timestamp to right" onClick={() => onCopyTime(node, 'left')}>
              🕓→
            </button>
            <button className="act" title="Copy right's timestamp to left" onClick={() => onCopyTime(node, 'right')}>
              ←🕓
            </button>
          </>
        )}
        {!readOnly && node.status === 'leftOnly' && (
          <button className="act danger" title="Delete left orphan" onClick={() => onDelete(node, 'left')}>
            🗑
          </button>
        )}
        {!readOnly && node.status === 'rightOnly' && (
          <button className="act danger" title="Delete right orphan" onClick={() => onDelete(node, 'right')}>
            🗑
          </button>
        )}
      </div>

      {/* Right side */}
      <div
        className={`pane-cell right ${node.right ? '' : 'absent'}`}
        onContextMenu={(e) => {
          if (node.right && onContextMenu) {
            e.preventDefault()
            onContextMenu(node.right.path)
          }
        }}
      >
        <span className="indent" style={{ width: indent }} />
        <span className="chevron">{chevron}</span>
        {node.right ? (
          <>
            <span className="icon">{icon}</span>
            <span className="name">{node.name}</span>
            {node.movedFrom && (
              <span className="moved" title={`Renamed/moved from ${node.movedFrom}`}>⇄</span>
            )}
            {node.kind === 'file' && (
              <span className="meta">
                {formatSize(node.right.size)} · {formatTime(node.right.mtimeMs)}
                {node.newer === 'right' && <span className="newer"> ●newer</span>}
              </span>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
