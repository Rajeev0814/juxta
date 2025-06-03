import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CompareNode, Side } from '../../shared/types'
import { DEFAULT_OPTIONS, type CompareOptions } from '../../shared/types'
import { listChangedFiles } from '../../shared/nav'
import { Toolbar } from './components/Toolbar'
import { FolderPicker } from './components/FolderPicker'
import { TwoPaneTree } from './components/TwoPaneTree'
import { FileCompare } from './components/FileCompare'
import { StatusBar } from './components/StatusBar'
import { useCompare } from './hooks/useCompare'
import { joinPath } from './lib/path'
import './styles/components.css'

type Theme = 'light' | 'dark'
type Mode = 'folders' | 'files'

function basename(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mode, setMode] = useState<Mode>('folders')
  const [leftRoot, setLeftRoot] = useState('')
  const [rightRoot, setRightRoot] = useState('')
  const [options, setOptions] = useState<CompareOptions>(DEFAULT_OPTIONS)
  const [hideIdentical, setHideIdentical] = useState(false)
  const [useTrash, setUseTrash] = useState(true)
  const [view, setView] = useState<'folder' | 'file'>('folder')
  const [activeNode, setActiveNode] = useState<CompareNode | null>(null)
  const [selectedRelPath, setSelectedRelPath] = useState<string | null>(null)
  const [reveal, setReveal] = useState<{ relPath: string; nonce: number } | null>(null)
  const navPosRef = useRef(-1)

  // Direct File Compare mode: two arbitrary files diffed without a folder pair.
  const [leftFile, setLeftFile] = useState('')
  const [rightFile, setRightFile] = useState('')
  const directNode = useMemo<CompareNode | null>(() => {
    if (!leftFile && !rightFile) return null
    return {
      name: basename(leftFile || rightFile),
      relPath: basename(leftFile || rightFile),
      kind: 'file',
      status: 'different',
      left: leftFile ? { path: leftFile, size: 0, mtimeMs: 0 } : undefined,
      right: rightFile ? { path: rightFile, size: 0, mtimeMs: 0 } : undefined
    }
  }, [leftFile, rightFile])

  const { result, comparing, progress, error, run, cancel } = useCompare()
  const navRef = useRef<{ next: () => void; prev: () => void } | null>(null)
  const hydratedRef = useRef(false)

  // Apply theme to <html> and to Electron's native chrome.
  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? 'theme-dark' : 'theme-light'
    void window.api.setTheme(theme)
  }, [theme])

  // Restore the previous session's settings once on startup.
  useEffect(() => {
    let cancelled = false
    void window.api.loadSettings().then((s) => {
      if (cancelled) return
      setTheme(s.theme)
      setMode(s.mode)
      setLeftRoot(s.leftRoot)
      setRightRoot(s.rightRoot)
      setLeftFile(s.leftFile)
      setRightFile(s.rightFile)
      setOptions(s.options)
      setHideIdentical(s.hideIdentical)
      setUseTrash(s.useTrash)
      hydratedRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Persist settings (debounced) whenever a tracked field changes.
  useEffect(() => {
    if (!hydratedRef.current) return
    const t = setTimeout(() => {
      void window.api.saveSettings({
        leftRoot,
        rightRoot,
        leftFile,
        rightFile,
        options,
        theme,
        mode,
        hideIdentical,
        useTrash,
        windowBounds: null // owned by the main process
      })
    }, 400)
    return () => clearTimeout(t)
  }, [leftRoot, rightRoot, leftFile, rightFile, options, theme, mode, hideIdentical, useTrash])

  const runCompare = useCallback(() => {
    if (!leftRoot || !rightRoot) return
    setView('folder')
    setActiveNode(null)
    void run(leftRoot, rightRoot, options)
  }, [leftRoot, rightRoot, options, run])

  const refresh = useCallback(() => {
    if (leftRoot && rightRoot) void run(leftRoot, rightRoot, options)
  }, [leftRoot, rightRoot, options, run])

  const swapSides = useCallback(() => {
    setLeftRoot(rightRoot)
    setRightRoot(leftRoot)
    setLeftFile(rightFile)
    setRightFile(leftFile)
  }, [leftRoot, rightRoot, leftFile, rightFile])

  const openFile = useCallback((node: CompareNode) => {
    if (node.kind !== 'file') return
    setActiveNode(node)
    setView('file')
  }, [])

  // --- Next/prev changed-file navigation in the folder tree ----------------
  const navList = useMemo(() => (result ? listChangedFiles(result.root) : []), [result])
  useEffect(() => {
    navPosRef.current = -1 // reset cursor on a fresh comparison
  }, [result])

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

  // --- Merge actions -------------------------------------------------------
  const onCopy = useCallback(
    async (node: CompareNode, direction: Side) => {
      const srcPath = direction === 'left' ? node.left?.path : node.right?.path
      if (!srcPath) return
      const destPath =
        direction === 'left' ? joinPath(rightRoot, node.relPath) : joinPath(leftRoot, node.relPath)
      const arrow = direction === 'left' ? 'right' : 'left'
      if (!window.confirm(`Copy "${node.name}" to the ${arrow} side?\n\n${destPath}`)) return
      await window.api.copyEntry({ srcPath, destPath })
      refresh()
    },
    [leftRoot, rightRoot, refresh]
  )

  const onDelete = useCallback(
    async (node: CompareNode, side: Side) => {
      const target = side === 'left' ? node.left?.path : node.right?.path
      if (!target) return
      const verb = useTrash ? 'Send to Recycle Bin' : 'Permanently delete'
      if (!window.confirm(`${verb} the ${side} "${node.name}"?\n\n${target}`)) return
      await window.api.deleteEntry({ path: target, toTrash: useTrash })
      refresh()
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
      refresh()
    },
    [result, refresh, useTrash]
  )

  // --- Menu actions (from the native application menu) ---------------------
  useEffect(() => {
    return window.api.onMenuAction((action) => {
      switch (action) {
        case 'compare':
          runCompare()
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

  // --- In-editor keyboard shortcuts (F4/F5 are owned by the menu) ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F6') {
        e.preventDefault()
        if (view === 'file' || mode === 'files')
          (e.shiftKey ? navRef.current?.prev : navRef.current?.next)?.()
      } else if (e.key === 'Escape' && view === 'file') {
        e.preventDefault()
        setView('folder')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, mode])

  return (
    <div className="app">
      <div className="tab-bar">
        <button
          className={`tab${mode === 'folders' ? ' active' : ''}`}
          onClick={() => setMode('folders')}
        >
          📁 Folder Compare
        </button>
        <button
          className={`tab${mode === 'files' ? ' active' : ''}`}
          onClick={() => setMode('files')}
        >
          📄 File Compare
        </button>
        <span className="tab-spacer" />
        <button className="theme-btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      {mode === 'folders' ? (
        <>
          <Toolbar
            leftRoot={leftRoot}
            rightRoot={rightRoot}
            options={options}
            comparing={comparing}
            theme={theme}
            onLeftRoot={setLeftRoot}
            onRightRoot={setRightRoot}
            onOptions={setOptions}
            onCompare={runCompare}
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
              <button onClick={() => makeMatch('left')} disabled={!result}>
                ⇒ Make right match left
              </button>
              <button onClick={() => makeMatch('right')} disabled={!result}>
                ⇐ Make left match right
              </button>
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
                ignoreWhitespace={options.filters.ignoreWhitespace}
                onClose={() => setView('folder')}
                onSaved={refresh}
                registerNav={(nav) => {
                  navRef.current = nav
                }}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <div className="toolbar-row pickers">
              <FolderPicker label="Left" value={leftFile} onChange={setLeftFile} file />
              <FolderPicker label="Right" value={rightFile} onChange={setRightFile} file />
            </div>
          </div>

          <div className="app-body">
            {directNode ? (
              <FileCompare
                key={`${leftFile}|${rightFile}`}
                node={directNode}
                theme={theme}
                ignoreWhitespace={options.filters.ignoreWhitespace}
                onClose={() => {
                  setLeftFile('')
                  setRightFile('')
                }}
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
