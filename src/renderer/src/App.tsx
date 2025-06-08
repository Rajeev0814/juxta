import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CompareNode, CompareResult, Side } from '../../shared/types'
import { listChangedFiles } from '../../shared/nav'
import {
  createSession,
  sessionTitle,
  SESSION_ICON,
  SESSION_LABEL,
  type Session,
  type SessionType
} from '../../shared/session'
import { Toolbar } from './components/Toolbar'
import { FolderPicker } from './components/FolderPicker'
import { TwoPaneTree } from './components/TwoPaneTree'
import { FileCompare } from './components/FileCompare'
import { TextCompare } from './components/TextCompare'
import { StatusBar } from './components/StatusBar'
import { useCompare } from './hooks/useCompare'
import { joinPath } from './lib/path'
import './styles/components.css'

type Theme = 'light' | 'dark'

function genId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function basename(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>('dark')
  const [hideIdentical, setHideIdentical] = useState(false)
  const [useTrash, setUseTrash] = useState(true)

  const [sessions, setSessions] = useState<Session[]>(() => [createSession('folders', 'session-0')])
  const [activeId, setActiveId] = useState('session-0')
  const [results, setResults] = useState<Record<string, CompareResult | null>>({})
  const [showNew, setShowNew] = useState(false)

  // Folder drill-down + navigation state (for the active folder session).
  const [view, setView] = useState<'folder' | 'file'>('folder')
  const [activeNode, setActiveNode] = useState<CompareNode | null>(null)
  const [selectedRelPath, setSelectedRelPath] = useState<string | null>(null)
  const [reveal, setReveal] = useState<{ relPath: string; nonce: number } | null>(null)
  const navPosRef = useRef(-1)

  const { comparing, progress, error, run, cancel } = useCompare()
  const navRef = useRef<{ next: () => void; prev: () => void } | null>(null)
  const hydratedRef = useRef(false)
  const newSessionRef = useRef<HTMLDivElement>(null)

  // Close the new-session menu on any click outside it.
  useEffect(() => {
    if (!showNew) return
    const onDown = (e: MouseEvent): void => {
      if (newSessionRef.current && !newSessionRef.current.contains(e.target as Node)) setShowNew(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showNew])

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]
  const result = results[active.id] ?? null

  const updateSession = useCallback((id: string, patch: Partial<Session>): void => {
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])
  const updateActive = useCallback(
    (patch: Partial<Session>) => updateSession(active.id, patch),
    [active.id, updateSession]
  )

  // --- Theme ----------------------------------------------------------------
  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? 'theme-dark' : 'theme-light'
    void window.api.setTheme(theme)
  }, [theme])

  // --- Settings hydrate / persist ------------------------------------------
  useEffect(() => {
    let cancelled = false
    void window.api.loadSettings().then((s) => {
      if (cancelled) return
      setSessions(s.sessions)
      setActiveId(s.activeSessionId)
      setTheme(s.theme)
      setHideIdentical(s.hideIdentical)
      setUseTrash(s.useTrash)
      hydratedRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    const t = setTimeout(() => {
      void window.api.saveSettings({
        sessions,
        activeSessionId: activeId,
        theme,
        hideIdentical,
        useTrash,
        windowBounds: null
      })
    }, 400)
    return () => clearTimeout(t)
  }, [sessions, activeId, theme, hideIdentical, useTrash])

  // Reset drill-down/navigation when switching sessions.
  useEffect(() => {
    setView('folder')
    setActiveNode(null)
    setSelectedRelPath(null)
    setReveal(null)
    navPosRef.current = -1
  }, [activeId])

  // --- Session tab operations ----------------------------------------------
  const addSession = useCallback((type: SessionType): void => {
    const s = createSession(type, genId())
    setSessions((list) => [...list, s])
    setActiveId(s.id)
    setShowNew(false)
  }, [])

  const closeSession = useCallback(
    (id: string): void => {
      setSessions((list) => {
        const idx = list.findIndex((s) => s.id === id)
        const next = list.filter((s) => s.id !== id)
        const final = next.length > 0 ? next : [createSession('folders', genId())]
        setActiveId((curr) => {
          if (curr !== id) return curr
          const neighbor = final[Math.max(0, Math.min(idx, final.length - 1))]
          return neighbor.id
        })
        return final
      })
      setResults((r) => {
        const { [id]: _removed, ...rest } = r
        return rest
      })
    },
    []
  )

  // --- Folder comparison ----------------------------------------------------
  const runCompare = useCallback(async () => {
    if (active.type !== 'folders' || !active.leftRoot || !active.rightRoot) return
    setView('folder')
    setActiveNode(null)
    const res = await run(active.leftRoot, active.rightRoot, active.options)
    if (res) setResults((r) => ({ ...r, [active.id]: res }))
  }, [active, run])

  const refresh = useCallback(async () => {
    if (active.type !== 'folders' || !active.leftRoot || !active.rightRoot) return
    const res = await run(active.leftRoot, active.rightRoot, active.options)
    if (res) setResults((r) => ({ ...r, [active.id]: res }))
  }, [active, run])

  const swapSides = useCallback(() => {
    updateActive({
      leftRoot: active.rightRoot,
      rightRoot: active.leftRoot,
      leftFile: active.rightFile,
      rightFile: active.leftFile,
      leftText: active.rightText,
      rightText: active.leftText
    })
  }, [active, updateActive])

  const openFile = useCallback((node: CompareNode) => {
    if (node.kind !== 'file') return
    setActiveNode(node)
    setView('file')
  }, [])

  // --- Next/prev changed-file navigation -----------------------------------
  const navList = useMemo(() => (result ? listChangedFiles(result.root) : []), [result])
  const gotoChangedFile = useCallback(
    (dir: 1 | -1) => {
      if (navList.length === 0) return
      navPosRef.current = (navPosRef.current + dir + navList.length) % navList.length
      const rel = navList[navPosRef.current]
      setSelectedRelPath(rel)
      setReveal((r) => ({ relPath: rel, nonce: (r?.nonce ?? 0) + 1 }))
    },
    [navList]
  )

  // --- Merge actions --------------------------------------------------------
  const onCopy = useCallback(
    async (node: CompareNode, direction: Side) => {
      const srcPath = direction === 'left' ? node.left?.path : node.right?.path
      if (!srcPath) return
      const destPath =
        direction === 'left' ? joinPath(active.rightRoot, node.relPath) : joinPath(active.leftRoot, node.relPath)
      const arrow = direction === 'left' ? 'right' : 'left'
      if (!window.confirm(`Copy "${node.name}" to the ${arrow} side?\n\n${destPath}`)) return
      await window.api.copyEntry({ srcPath, destPath })
      void refresh()
    },
    [active.leftRoot, active.rightRoot, refresh]
  )

  const onDelete = useCallback(
    async (node: CompareNode, side: Side) => {
      const target = side === 'left' ? node.left?.path : node.right?.path
      if (!target) return
      const verb = useTrash ? 'Send to Recycle Bin' : 'Permanently delete'
      if (!window.confirm(`${verb} the ${side} "${node.name}"?\n\n${target}`)) return
      await window.api.deleteEntry({ path: target, toTrash: useTrash })
      void refresh()
    },
    [refresh, useTrash]
  )

  const makeMatch = useCallback(
    async (direction: Side) => {
      if (!result) return
      const target = direction === 'left' ? 'right' : 'left'
      if (
        !window.confirm(
          `Make the ${target} folder match the ${direction} folder?\n\n` +
            `This copies differences and deletes ${target}-only files. This cannot be undone.`
        )
      )
        return
      await window.api.makeMatch({ result, direction, toTrash: useTrash })
      void refresh()
    },
    [result, refresh, useTrash]
  )

  // --- Menu actions ---------------------------------------------------------
  useEffect(() => {
    return window.api.onMenuAction((action) => {
      switch (action) {
        case 'compare':
          void runCompare()
          break
        case 'cancel':
          cancel()
          break
        case 'nextDiff':
          gotoChangedFile(1)
          break
        case 'prevDiff':
          gotoChangedFile(-1)
          break
        case 'toggleTheme':
          setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
          break
        case 'toggleHideIdentical':
          setHideIdentical((v) => !v)
          break
        case 'swapSides':
          swapSides()
          break
        case 'about':
          window.alert('Juxta — a desktop file & folder comparison and merge tool.')
          break
      }
    })
  }, [runCompare, cancel, gotoChangedFile, swapSides])

  // --- In-editor keyboard shortcuts (F4/F5 owned by the menu) --------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F6') {
        e.preventDefault()
        if (view === 'file' || active.type === 'files' || active.type === 'text')
          (e.shiftKey ? navRef.current?.prev : navRef.current?.next)?.()
      } else if (e.key === 'Escape' && view === 'file') {
        e.preventDefault()
        setView('folder')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, active.type])

  const directNode = useMemo<CompareNode | null>(() => {
    if (active.type !== 'files') return null
    if (!active.leftFile && !active.rightFile) return null
    return {
      name: basename(active.leftFile || active.rightFile),
      relPath: basename(active.leftFile || active.rightFile),
      kind: 'file',
      status: 'different',
      left: active.leftFile ? { path: active.leftFile, size: 0, mtimeMs: 0 } : undefined,
      right: active.rightFile ? { path: active.rightFile, size: 0, mtimeMs: 0 } : undefined
    }
  }, [active.type, active.leftFile, active.rightFile])

  return (
    <div className="app">
      <div className="tab-bar">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`tab${s.id === activeId ? ' active' : ''}`}
            onClick={() => setActiveId(s.id)}
            title={sessionTitle(s)}
          >
            <span className="tab-icon">{SESSION_ICON[s.type]}</span>
            <span className="tab-title">{sessionTitle(s)}</span>
            <span
              className="tab-close"
              title="Close session"
              onClick={(e) => {
                e.stopPropagation()
                closeSession(s.id)
              }}
            >
              ×
            </span>
          </div>
        ))}

        <div className="new-session" ref={newSessionRef}>
          <button className="tab-new" onClick={() => setShowNew((v) => !v)} title="New session">
            +
          </button>
          {showNew && (
            <div className="new-menu">
              {(['folders', 'files', 'text'] as SessionType[]).map((t) => (
                <button key={t} onClick={() => addSession(t)}>
                  {SESSION_ICON[t]} {SESSION_LABEL[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="tab-spacer" />
        <button className="theme-btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      {active.type === 'folders' && (
        <>
          <Toolbar
            leftRoot={active.leftRoot}
            rightRoot={active.rightRoot}
            options={active.options}
            comparing={comparing}
            theme={theme}
            onLeftRoot={(p) => updateActive({ leftRoot: p })}
            onRightRoot={(p) => updateActive({ rightRoot: p })}
            onOptions={(o) => updateActive({ options: o })}
            onCompare={() => void runCompare()}
            onCancel={cancel}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          />

          {result && view === 'folder' && (
            <div className="merge-bar">
              <button onClick={() => gotoChangedFile(-1)} disabled={navList.length === 0} title="Previous changed file (Shift+F4)">
                ↥ Prev diff
              </button>
              <button onClick={() => gotoChangedFile(1)} disabled={navList.length === 0} title="Next changed file (F4)">
                ↧ Next diff
              </button>
              <span className="nav-count">{navList.length} changed</span>
              <span className="mb-sep" />
              <button onClick={() => makeMatch('left')}>⇒ Make right match left</button>
              <button onClick={() => makeMatch('right')}>⇐ Make left match right</button>
              <span className="hint">F4 next diff · F5 re-compare · double-click a file to diff</span>
            </div>
          )}

          <div className="app-body">
            {error && <div className="banner error">Comparison failed: {error}</div>}
            {!result && !comparing && (
              <div className="empty-state">
                <h2>Folder Compare</h2>
                <p>Pick two folders above (or drag them in) and press Compare.</p>
              </div>
            )}
            {result && view === 'folder' && (
              <TwoPaneTree
                key={active.id}
                result={result}
                hideIdentical={hideIdentical}
                selectedRelPath={selectedRelPath}
                reveal={reveal}
                onSelect={(n) => setSelectedRelPath(n.relPath)}
                onOpenFile={openFile}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            )}
            {view === 'file' && activeNode && (
              <FileCompare
                node={activeNode}
                theme={theme}
                ignoreWhitespace={active.options.filters.ignoreWhitespace}
                onClose={() => setView('folder')}
                onSaved={() => void refresh()}
                registerNav={(nav) => {
                  navRef.current = nav
                }}
              />
            )}
          </div>
        </>
      )}

      {active.type === 'files' && (
        <>
          <div className="toolbar">
            <div className="toolbar-row pickers">
              <FolderPicker label="Left" value={active.leftFile} onChange={(p) => updateActive({ leftFile: p })} file />
              <FolderPicker label="Right" value={active.rightFile} onChange={(p) => updateActive({ rightFile: p })} file />
            </div>
          </div>
          <div className="app-body">
            {directNode ? (
              <FileCompare
                key={`${active.id}:${active.leftFile}|${active.rightFile}`}
                node={directNode}
                theme={theme}
                ignoreWhitespace={false}
                onClose={() => updateActive({ leftFile: '', rightFile: '' })}
                registerNav={(nav) => {
                  navRef.current = nav
                }}
              />
            ) : (
              <div className="empty-state">
                <h2>File Compare</h2>
                <p>Pick two files above (or drag them in) to see a side-by-side diff.</p>
              </div>
            )}
          </div>
        </>
      )}

      {active.type === 'text' && (
        <div className="app-body">
          <TextCompare
            key={active.id}
            theme={theme}
            ignoreWhitespace={false}
            initialLeft={active.leftText}
            initialRight={active.rightText}
            onChange={(l, r) => updateSession(active.id, { leftText: l, rightText: r })}
            registerNav={(nav) => {
              navRef.current = nav
            }}
          />
        </div>
      )}

      <StatusBar
        result={result}
        progress={progress}
        comparing={comparing}
        hideIdentical={hideIdentical}
        onToggleHideIdentical={setHideIdentical}
        useTrash={useTrash}
        onToggleTrash={setUseTrash}
      />
    </div>
  )
}
