import { DiffEditor } from '@monaco-editor/react'
import React, { useEffect, useMemo, useState } from 'react'
import { diffStructured, parseStructured, structKind, type StructNode } from '../../../shared/structured'
import { codeLanguage } from '../../../shared/jsast'
import { juxtaTheme } from '../lib/monacoSetup'

interface Props {
  left: string
  right: string
  theme: 'light' | 'dark'
  hideIdentical: boolean
}

function monacoLang(kind: string, path: string): string {
  if (kind === 'js') return codeLanguage(path) // javascript | typescript
  return kind // json | yaml | xml
}

function scalar(v: unknown): string {
  if (v === undefined) return ''
  return typeof v === 'string' ? v : JSON.stringify(v)
}

interface Flat {
  node: StructNode
  path: string
  depth: number
  hasChildren: boolean
  expanded: boolean
}

function flatten(node: StructNode, expanded: Set<string>, hideId: boolean): Flat[] {
  const out: Flat[] = []
  const walk = (n: StructNode, path: string, depth: number): void => {
    if (hideId && n.status === 'identical') return
    const kids = n.children ?? []
    const hasChildren = kids.length > 0
    const isOpen = expanded.has(path)
    if (depth >= 0) out.push({ node: n, path, depth, hasChildren, expanded: isOpen })
    if (hasChildren && (isOpen || depth < 0)) {
      for (const c of kids) walk(c, `${path}/${c.key}`, depth + 1)
    }
  }
  // Root is a synthetic container; render its children at depth 0.
  walk(node, '', -1)
  return out
}

/** All container node paths, for the default "expand everything" state. */
function allContainerPaths(node: StructNode): string[] {
  const paths: string[] = []
  const walk = (n: StructNode, path: string): void => {
    if (n.children && n.children.length) {
      paths.push(path)
      for (const c of n.children) walk(c, `${path}/${c.key}`)
    }
  }
  walk(node, '')
  return paths
}

/** Key-aligned structured comparison for JSON / YAML / XML documents. */
export function StructuredCompareView({ left, right, theme, hideIdentical }: Props): React.JSX.Element {
  const kind = structKind(left) ?? 'json'
  const kindLabel = kind === 'js' ? (codeLanguage(left) === 'typescript' ? 'TS' : 'JS') : kind.toUpperCase()
  const [leftText, setLeftText] = useState<string | null>(null)
  const [rightText, setRightText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // JS/AST trees are verbose, so code defaults to raw text (tree is a toggle);
  // data formats default to the structured tree.
  const [mode, setMode] = useState<'tree' | 'raw'>(kind === 'js' ? 'raw' : 'tree')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLeftText(null)
    setRightText(null)
    setError(null)
    Promise.all([window.api.readFile(left), window.api.readFile(right)])
      .then(([l, r]) => {
        if (cancelled) return
        if (l.binary || r.binary) throw new Error('file looks binary')
        setLeftText(l.text)
        setRightText(r.text)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [left, right])

  const parsed = useMemo(() => {
    if (leftText === null || rightText === null) return null
    const l = parseStructured(leftText, kind, left)
    const r = parseStructured(rightText, kind, right)
    if ('error' in l) return { parseError: `left: ${l.error}` }
    if ('error' in r) return { parseError: `right: ${r.error}` }
    return { tree: diffStructured(l.value, r.value) }
  }, [leftText, rightText, kind, left, right])

  const tree = parsed && 'tree' in parsed ? parsed.tree : null
  const parseError = parsed && 'parseError' in parsed ? parsed.parseError : null

  // Default to fully expanded once a tree is available.
  useEffect(() => {
    if (tree) setExpanded(new Set(allContainerPaths(tree)))
  }, [tree])

  // Fall back to raw text automatically when structured parsing fails.
  const effectiveMode = parseError ? 'raw' : mode
  const rows = useMemo(
    () => (tree ? flatten(tree, expanded, hideIdentical) : []),
    [tree, expanded, hideIdentical]
  )

  const toggle = (path: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  if (error) return <div className="fc-message error">Failed to load: {error}</div>
  if (leftText === null || rightText === null) return <div className="fc-message">Loading…</div>

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name">Structured Compare</span>
        <span className="fc-enc">{kindLabel}</span>
        {parseError && <span className="fc-hint error">Can’t parse as {kindLabel}: {parseError}</span>}
        <div className="fc-actions">
          <button
            className={effectiveMode === 'tree' ? 'primary' : ''}
            disabled={!!parseError}
            onClick={() => setMode('tree')}
            title={parseError ? 'Parsing failed — raw text only' : 'Key-aligned structured tree'}
          >
            ⊟ {kind === 'js' ? 'AST' : 'Structured'}
          </button>
          <button
            className={effectiveMode === 'raw' ? 'primary' : ''}
            onClick={() => setMode('raw')}
            title="Raw text diff"
          >
            ☰ Raw text
          </button>
        </div>
      </div>

      <div className="file-compare-body">
        {effectiveMode === 'raw' ? (
          <DiffEditor
            original={leftText}
            modified={rightText}
            language={monacoLang(kind, left)}
            theme={juxtaTheme(theme)}
            options={{
              readOnly: true,
              renderSideBySide: true,
              automaticLayout: true,
              minimap: { enabled: true, renderCharacters: false },
              scrollBeyondLastLine: false,
              fontSize: 12
            }}
          />
        ) : (
          <div className="struct-tree">
            {rows.map((row) => (
              <StructRow key={row.path} row={row} onToggle={toggle} />
            ))}
            {rows.length === 0 && <div className="fc-message">No differences.</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function StructRow({ row, onToggle }: { row: Flat; onToggle: (p: string) => void }): React.JSX.Element {
  const { node, depth, hasChildren, expanded, path } = row
  const cls =
    node.status === 'changed'
      ? 'st-different'
      : node.status === 'added'
        ? 'st-right-only'
        : node.status === 'removed'
          ? 'st-left-only'
          : ''
  const chevron = hasChildren ? (expanded ? '▾' : '▸') : ''
  const label = node.key === '' ? '(root)' : node.key

  return (
    <div
      className={`struct-row ${cls}`}
      style={{ paddingLeft: depth * 16 + 6 }}
      onClick={() => hasChildren && onToggle(path)}
    >
      <span className="chevron">{chevron}</span>
      <span className="struct-key">{label}</span>
      {hasChildren ? (
        <span className="struct-val dim">
          {node.kind === 'array' ? `[${node.children!.length}]` : `{${node.children!.length}}`}
        </span>
      ) : (
        <span className="struct-val">
          {node.status === 'changed' ? (
            <>
              <span className="del">{scalar(node.left)}</span>
              <span className="arrow"> → </span>
              <span className="add">{scalar(node.right)}</span>
            </>
          ) : node.status === 'added' ? (
            <span className="add">{scalar(node.right)}</span>
          ) : node.status === 'removed' ? (
            <span className="del">{scalar(node.left)}</span>
          ) : (
            <span className="dim">{scalar(node.left)}</span>
          )}
        </span>
      )}
    </div>
  )
}
