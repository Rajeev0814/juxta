import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CompareNode, CompareResult, Side } from '../../../shared/types'
import { ancestorsOf } from '../../../shared/nav'
import { defaultExpanded, flatten, formatSize, formatTime, statusClass } from '../lib/treeUtils'

const ROW_H = 24
const OVERSCAN = 12

interface Props {
  result: CompareResult
  hideIdentical: boolean
  selectedRelPath: string | null
  /** When set, expand ancestors and scroll this relPath into view. */
  reveal: { relPath: string; nonce: number } | null
  onSelect: (node: CompareNode) => void
  onOpenFile: (node: CompareNode) => void
  onCopy: (node: CompareNode, direction: Side) => void
  onDelete: (node: CompareNode, side: Side) => void
  onCopyTime: (node: CompareNode, direction: Side) => void
}

export function TwoPaneTree(props: Props): React.JSX.Element {
  const { result } = props
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded(result.root))
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
    () => flatten(result.root, expanded, props.hideIdentical),
    [result, expanded, props.hideIdentical]
  )

  // Reveal a target row: expand its ancestors and scroll it to center.
  const reveal = props.reveal
  useEffect(() => {
    if (!reveal) return
    const next = new Set(expanded)
    for (const a of ancestorsOf(reveal.relPath)) next.add(a)
    setExpanded(next)
    const freshRows = flatten(result.root, next, props.hideIdentical)
    const idx = freshRows.findIndex((r) => r.node.relPath === reveal.relPath)
    const scroller = scrollerRef.current
    if (idx >= 0 && scroller) {
      scroller.scrollTop = Math.max(0, idx * ROW_H - scroller.clientHeight / 2 + ROW_H)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal])

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
                selected={props.selectedRelPath === row.node.relPath}
                onToggle={toggle}
                onSelect={props.onSelect}
                onOpenFile={props.onOpenFile}
                onCopy={props.onCopy}
                onDelete={props.onDelete}
                onCopyTime={props.onCopyTime}
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
  selected: boolean
  onToggle: (relPath: string) => void
  onSelect: (node: CompareNode) => void
  onOpenFile: (node: CompareNode) => void
  onCopy: (node: CompareNode, direction: Side) => void
  onDelete: (node: CompareNode, side: Side) => void
  onCopyTime: (node: CompareNode, direction: Side) => void
}

function TreeRow({ row, selected, onToggle, onSelect, onOpenFile, onCopy, onDelete, onCopyTime }: RowProps): React.JSX.Element {
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
      <div className={`pane-cell left ${node.left ? '' : 'absent'}`}>
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
          </>
        ) : null}
      </div>

      {/* Center action gutter */}
      <div className="gutter" onClick={(e) => e.stopPropagation()}>
        {node.left && (
          <button className="act" title="Copy to right →" onClick={() => onCopy(node, 'left')}>
            →
          </button>
        )}
        {node.right && (
          <button className="act" title="← Copy to left" onClick={() => onCopy(node, 'right')}>
            ←
          </button>
        )}
        {node.kind === 'file' && node.left && node.right && node.status === 'different' && (
          <>
            <button className="act" title="Copy left's timestamp to right" onClick={() => onCopyTime(node, 'left')}>
              🕓→
            </button>
            <button className="act" title="Copy right's timestamp to left" onClick={() => onCopyTime(node, 'right')}>
              ←🕓
            </button>
          </>
        )}
        {node.status === 'leftOnly' && (
          <button className="act danger" title="Delete left orphan" onClick={() => onDelete(node, 'left')}>
            🗑
          </button>
        )}
        {node.status === 'rightOnly' && (
          <button className="act danger" title="Delete right orphan" onClick={() => onDelete(node, 'right')}>
            🗑
          </button>
        )}
      </div>

      {/* Right side */}
      <div className={`pane-cell right ${node.right ? '' : 'absent'}`}>
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
