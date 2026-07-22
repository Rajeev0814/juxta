import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CompareNode, CompareResult, Side } from '../../shared/types'
import { listChangedFiles } from '../../shared/nav'
import { planSync, planTimestamp, type SyncMode } from '../../shared/sync'
import { toHtmlReport, toCsvReport } from '../../shared/report'
import type { CompareProfile, ProjectScope } from '../../shared/settings'
import { findConverter, type FormatConverter } from '../../shared/converters'
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
import { MergeView } from './components/MergeView'
import { Folder3Compare } from './components/Folder3Compare'
import { ArchiveCompareView } from './components/ArchiveCompareView'
import { ImageCompareView } from './components/ImageCompareView'
import { ExtractedTextCompareView } from './components/ExtractedTextCompareView'
import { TableCompareView } from './components/TableCompareView'
import { StructuredCompareView } from './components/StructuredCompareView'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { isArchivePath } from '../../shared/archive'
import { isImagePath } from '../../shared/image'
import { isPdfPath } from '../../shared/pdf'
import { isOfficePath } from '../../shared/office'
import { isTablePath } from '../../shared/csv'
import { structKind } from '../../shared/structured'
import { isFtpUrl, needsPasswordPrompt } from '../../shared/ftp'
import { PasswordPrompt } from './components/PasswordPrompt'
import type { MergeArgs } from '../../shared/git'
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
  const [profiles, setProfiles] = useState<CompareProfile[]>([])
  const [projectScopes, setProjectScopes] = useState<ProjectScope[]>([])
  const [converters, setConverters] = useState<FormatConverter[]>([])
  const [live, setLive] = useState(false)
  const [mergeRequest, setMergeRequest] = useState<MergeArgs | null>(null)
  const [results, setResults] = useState<Record<string, CompareResult | null>>({})
  const [showNew, setShowNew] = useState(false)

  // Folder drill-down + navigation state (for the active folder session).
  const [view, setView] = useState<'folder' | 'file'>('folder')
  const [activeNode, setActiveNode] = useState<CompareNode | null>(null)
  const [selectedRelPath, setSelectedRelPath] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [passwordFor, setPasswordFor] = useState<string | null>(null)
  const [reveal, setReveal] = useState<{ relPath: string; nonce: number } | null>(null)
  const [expandSignal, setExpandSignal] = useState<{ mode: 'all' | 'none' | 'default'; nonce: number } | null>(null)
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
      setProfiles(s.profiles)
      setProjectScopes(s.projectScopes)
      setConverters(s.converters)
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
        windowBounds: null,
        profiles,
        projectScopes,
        converters
      })
    }, 400)
    return () => clearTimeout(t)
  }, [sessions, activeId, theme, hideIdentical, useTrash, profiles, projectScopes, converters])

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

  // Open a File Compare tab for two given paths (used by git difftool launches).
  const openFilesSession = useCallback((left: string, right: string): void => {
    const s = { ...createSession('files', genId()), leftFile: left, rightFile: right }
    setSessions((list) => [...list, s])
    setActiveId(s.id)
  }, [])

  // Open a Folder Compare tab with two roots (used by the Explorer context menu).
  const openFoldersSession = useCallback((left: string, right: string): void => {
    const s = { ...createSession('folders', genId()), leftRoot: left, rightRoot: right }
    setSessions((list) => [...list, s])
    setActiveId(s.id)
  }, [])

  const openShellCompare = useCallback(
    (c: { kind: 'files' | 'folders'; left: string; right: string }): void => {
      if (c.kind === 'folders') openFoldersSession(c.left, c.right)
      else openFilesSession(c.left, c.right)
    },
    [openFilesSession, openFoldersSession]
  )

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
  const execCompare = useCallback(
    async (password?: string) => {
      if (active.type !== 'folders' || !active.leftRoot || !active.rightRoot) return
      const res = await run(active.leftRoot, active.rightRoot, active.options, password)
      if (res) setResults((r) => ({ ...r, [active.id]: res }))
    },
    [active, run]
  )

  /** The remote side needing a password prompt, or '' if none. */
  const remoteNeedingPassword = (): string => {
    const remote = isFtpUrl(active.leftRoot) ? active.leftRoot : isFtpUrl(active.rightRoot) ? active.rightRoot : ''
    return remote && needsPasswordPrompt(remote) ? remote : ''
  }

  const runCompare = useCallback(async () => {
    if (active.type !== 'folders' || !active.leftRoot || !active.rightRoot) return
    setView('folder')
    setActiveNode(null)
    const remote = remoteNeedingPassword()
    if (remote) {
      setPasswordFor(remote)
      return
    }
    await execCompare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, execCompare])

  const refresh = useCallback(async () => {
    if (active.type !== 'folders' || !active.leftRoot || !active.rightRoot) return
    const remote = remoteNeedingPassword()
    if (remote) {
      setPasswordFor(remote)
      return
    }
    await execCompare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, execCompare])

  const submitPassword = useCallback(
    (pw: string) => {
      setPasswordFor(null)
      void execCompare(pw)
    },
    [execCompare]
  )

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

  const handleSnapshot = useCallback(
    async (action: 'save:left' | 'save:right' | 'open:left' | 'open:right') => {
      const [op, side] = action.split(':') as ['save' | 'open', 'left' | 'right']
      if (op === 'save') {
        const root = side === 'left' ? active.leftRoot : active.rightRoot
        if (!root) return
        const saved = await window.api.saveSnapshot(root, active.options)
        if (saved) {
          setNotice(`Snapshot saved: ${saved}`)
          setTimeout(() => setNotice(null), 4000)
        }
      } else {
        const picked = await window.api.selectSnapshot()
        if (picked) updateActive(side === 'left' ? { leftRoot: picked } : { rightRoot: picked })
      }
    },
    [active.leftRoot, active.rightRoot, active.options, updateActive]
  )

  const applyProfile = useCallback(
    (name: string) => {
      const p = profiles.find((x) => x.name === name)
      if (p) updateActive({ options: p.options })
    },
    [profiles, updateActive]
  )

  const saveProfile = useCallback(() => {
    const name = window.prompt('Save current rule + filters as profile named:')?.trim()
    if (!name) return
    setProfiles((list) => [...list.filter((p) => p.name !== name), { name, options: active.options }])
  }, [active.options])

  // --- Per-project scoping: remember options for a specific folder pair ------
  const scopeFor = useCallback(
    (left: string, right: string): ProjectScope | undefined =>
      projectScopes.find((s) => s.left === left && s.right === right),
    [projectScopes]
  )

  const projectPinned =
    active.type === 'folders' && !!active.leftRoot && !!active.rightRoot && !!scopeFor(active.leftRoot, active.rightRoot)

  const togglePin = useCallback(() => {
    if (active.type !== 'folders' || !active.leftRoot || !active.rightRoot) return
    const { leftRoot: left, rightRoot: right, options } = active
    setProjectScopes((list) => {
      if (list.some((s) => s.left === left && s.right === right)) {
        return list.filter((s) => !(s.left === left && s.right === right))
      }
      return [...list, { left, right, options: JSON.parse(JSON.stringify(options)) }]
    })
  }, [active])

  // Auto-apply a pinned pair's options whenever that pair becomes active.
  useEffect(() => {
    if (active.type !== 'folders' || !active.leftRoot || !active.rightRoot) return
    const scope = scopeFor(active.leftRoot, active.rightRoot)
    if (scope) updateActive({ options: JSON.parse(JSON.stringify(scope.options)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id, active.leftRoot, active.rightRoot])

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

  const onCopyTime = useCallback(
    async (node: CompareNode, direction: Side) => {
      const plan = planTimestamp(node, direction)
      if (!plan) return
      await window.api.setFileTimes(plan.path, plan.mtimeMs)
      void refresh()
    },
    [refresh]
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

  // --- Folder sync (mirror / update / two-way) with dry-run preview --------
  const runSync = useCallback(
    async (mode: SyncMode, direction?: Side) => {
      if (!result) return
      const { actions, conflicts } = planSync(result.root, result.leftRoot, result.rightRoot, {
        mode,
        direction
      })
      const copies = actions.filter((a) => a.kind === 'copy').length
      const deletes = actions.filter((a) => a.kind === 'delete').length
      if (copies === 0 && deletes === 0) {
        window.alert('Already in sync — nothing to do.' + (conflicts.length ? `\n(${conflicts.length} conflict(s))` : ''))
        return
      }
      const lines = [`Sync preview:`, `  ${copies} copy, ${deletes} delete`]
      if (conflicts.length) lines.push(`  ${conflicts.length} conflict(s) skipped (both sides changed)`)
      lines.push('', 'Proceed?')
      if (!window.confirm(lines.join('\n'))) return
      await window.api.applyPlan(actions, useTrash)
      void refresh()
    },
    [result, useTrash, refresh]
  )

  const onSyncSelect = useCallback(
    (value: string) => {
      if (value === 'twoWay') void runSync('twoWay')
      else {
        const [mode, dir] = value.split(':')
        void runSync(mode as SyncMode, dir as Side)
      }
    },
    [runSync]
  )

  // --- Git difftool: open launch/forwarded diff pairs as File Compare tabs -
  useEffect(() => {
    void window.api.getLaunchDiff().then((pair) => {
      if (pair) openFilesSession(pair.left, pair.right)
    })
    void window.api.getLaunchMerge().then((m) => {
      if (m) setMergeRequest(m)
    })
    void window.api.getLaunchCompare().then((c) => {
      if (c) openShellCompare(c)
    })
    const offDiff = window.api.onOpenDiff((pair) => openFilesSession(pair.left, pair.right))
    const offMerge = window.api.onOpenMerge((m) => setMergeRequest(m))
    const offCompare = window.api.onOpenCompare((c) => openShellCompare(c))
    return () => {
      offDiff()
      offMerge()
      offCompare()
    }
  }, [openFilesSession, openShellCompare])

  // --- Live re-compare: watch the active folder roots while enabled --------
  useEffect(() => {
    // Don't try to fs.watch a remote (ftp://) root.
    const watchable =
      live &&
      active.type === 'folders' &&
      active.leftRoot &&
      active.rightRoot &&
      !isFtpUrl(active.leftRoot) &&
      !isFtpUrl(active.rightRoot)
        ? [active.leftRoot, active.rightRoot]
        : null
    void window.api.setWatch(watchable)
    return () => {
      void window.api.setWatch(null)
    }
  }, [live, active.type, active.leftRoot, active.rightRoot])

  useEffect(() => {
    return window.api.onWatchChanged(() => {
      if (live && active.type === 'folders' && view === 'folder') void refresh()
    })
  }, [live, active.type, view, refresh])

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
        case 'gitSetup':
          void window.api.getGitSetup().then((cmds) => {
            void window.api.writeClipboard(cmds)
            window.alert(
              'Run these in a shell (e.g. Git Bash) to use Juxta with `git difftool` and `git mergetool` — copied to your clipboard:\n\n' +
                cmds
            )
          })
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
      const target = e.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (e.key === 'F6') {
        e.preventDefault()
        if (mergeRequest || view === 'file' || active.type === 'files' || active.type === 'text')
          (e.shiftKey ? navRef.current?.prev : navRef.current?.next)?.()
      } else if (e.key === '?' && !typing) {
        e.preventDefault()
        setShowHelp((v) => !v)
      } else if (e.key === 'Escape') {
        if (showHelp) {
          e.preventDefault()
          setShowHelp(false)
        } else if (view === 'file') {
          e.preventDefault()
          setView('folder')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, active.type, mergeRequest, showHelp])

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

  // Mergetool launch takes over the whole window until done.
  if (mergeRequest) {
    return (
      <div className="app">
        <MergeView
          args={mergeRequest}
          theme={theme}
          onDone={() => setMergeRequest(null)}
          registerNav={(nav) => {
            navRef.current = nav
          }}
        />
      </div>
    )
  }


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
              <button onClick={() => addSession('folders3')}>{SESSION_ICON.folders3} {SESSION_LABEL.folders3}</button>
            </div>
          )}
        </div>

        <span className="tab-spacer" />
        <button className="theme-btn" onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)">
          ?
        </button>
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
            onSwap={swapSides}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            profiles={profiles}
            onApplyProfile={applyProfile}
            onSaveProfile={saveProfile}
            onSnapshot={handleSnapshot}
            projectPinned={projectPinned}
            onTogglePin={togglePin}
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
              <button
                onClick={() => setExpandSignal((s) => ({ mode: 'all', nonce: (s?.nonce ?? 0) + 1 }))}
                title="Expand all folders"
              >
                ⊞ Expand
              </button>
              <button
                onClick={() => setExpandSignal((s) => ({ mode: 'none', nonce: (s?.nonce ?? 0) + 1 }))}
                title="Collapse all folders"
              >
                ⊟ Collapse
              </button>
              <label className="mb-toggle" title="Re-compare automatically when files change">
                <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
                👁 Live
              </label>
              <span className="mb-sep" />
              <button onClick={() => makeMatch('left')}>⇒ Make right match left</button>
              <button onClick={() => makeMatch('right')}>⇐ Make left match right</button>
              <select
                className="sync-select"
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  e.currentTarget.value = ''
                  if (v) onSyncSelect(v)
                }}
                title="Synchronize folders (preview before applying)"
              >
                <option value="" disabled>
                  Sync…
                </option>
                <option value="mirror:left">Mirror L→R (exact)</option>
                <option value="mirror:right">Mirror R→L (exact)</option>
                <option value="update:left">Update L→R (no deletes)</option>
                <option value="update:right">Update R→L (no deletes)</option>
                <option value="twoWay">Two-way (newer wins)</option>
              </select>
              <button
                onClick={() => {
                  if (result) void window.api.saveText('juxta-report.html', toHtmlReport(result))
                }}
                title="Export an HTML report of this comparison"
              >
                ⤓ Report
              </button>
              <button
                onClick={() => {
                  if (result) void window.api.saveText('juxta-report.csv', toCsvReport(result))
                }}
                title="Export the changed files as CSV"
              >
                ⤓ CSV
              </button>
              <span className="hint">F4 next diff · F5 re-compare · double-click a file to diff</span>
            </div>
          )}

          <div className="app-body">
            {error && <div className="banner error">Comparison failed: {error}</div>}
            {notice && <div className="banner">{notice}</div>}
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
                expandSignal={expandSignal}
                onSelect={(n) => setSelectedRelPath(n.relPath)}
                onOpenFile={openFile}
                onCopy={onCopy}
                onDelete={onDelete}
                onCopyTime={onCopyTime}
                onContextMenu={(path) => void window.api.popupPathMenu(path)}
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
            {active.leftFile && active.rightFile && isArchivePath(active.leftFile) && isArchivePath(active.rightFile) ? (
              <ArchiveCompareView left={active.leftFile} right={active.rightFile} hideIdentical={hideIdentical} theme={theme} />
            ) : active.leftFile && active.rightFile && isImagePath(active.leftFile) && isImagePath(active.rightFile) ? (
              <ImageCompareView left={active.leftFile} right={active.rightFile} />
            ) : active.leftFile && active.rightFile && isPdfPath(active.leftFile) && isPdfPath(active.rightFile) ? (
              <ExtractedTextCompareView
                key={`${active.id}:${active.leftFile}|${active.rightFile}`}
                left={active.leftFile}
                right={active.rightFile}
                theme={theme}
                title="PDF Compare"
                extract={(p) => window.api.readPdfText(p)}
                registerNav={(nav) => {
                  navRef.current = nav
                }}
              />
            ) : active.leftFile && active.rightFile && isOfficePath(active.leftFile) && isOfficePath(active.rightFile) ? (
              <ExtractedTextCompareView
                key={`${active.id}:${active.leftFile}|${active.rightFile}`}
                left={active.leftFile}
                right={active.rightFile}
                theme={theme}
                title="Document Compare"
                extract={(p) => window.api.readOfficeText(p)}
                registerNav={(nav) => {
                  navRef.current = nav
                }}
              />
            ) : active.leftFile && active.rightFile && isTablePath(active.leftFile) && isTablePath(active.rightFile) ? (
              <TableCompareView left={active.leftFile} right={active.rightFile} hideIdentical={hideIdentical} />
            ) : active.leftFile && active.rightFile && structKind(active.leftFile) && structKind(active.rightFile) ? (
              <StructuredCompareView
                left={active.leftFile}
                right={active.rightFile}
                theme={theme}
                hideIdentical={hideIdentical}
              />
            ) : active.leftFile &&
              active.rightFile &&
              findConverter(converters, active.leftFile) &&
              findConverter(converters, active.rightFile) ? (
              <ExtractedTextCompareView
                key={`${active.id}:${active.leftFile}|${active.rightFile}`}
                left={active.leftFile}
                right={active.rightFile}
                theme={theme}
                title={`${findConverter(converters, active.leftFile)!.name} (converted)`}
                extract={(p) => window.api.runFormatConverter(p)}
                registerNav={(nav) => {
                  navRef.current = nav
                }}
              />
            ) : directNode ? (
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
                <p className="empty-hint">
                  The right comparator is chosen automatically from the file types:
                  <br />
                  🖼 <b>images</b> (png/jpg/gif/webp…) → side-by-side, overlay, swipe &amp; pixel-diff
                  <br />
                  📄 <b>PDF &amp; Office</b> (pdf/docx/xlsx/pptx) → extracted-text diff
                  <br />
                  🗜 <b>archives</b> (zip/jar/tar/tgz…) → content-tree compare
                  <br />
                  📊 <b>tables</b> (csv/tsv) → key-aligned row/cell compare
                  <br />
                  🧩 <b>structured</b> (json/yaml/xml) → key-aligned tree · <b>js/ts</b> (+jsx/tsx) → text + AST toggle
                  <br />
                  📝 anything else → text / hex diff
                </p>
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

      {active.type === 'folders3' && (
        <div className="app-body">
          <Folder3Compare
            key={active.id}
            baseRoot={active.baseRoot}
            leftRoot={active.leftRoot}
            rightRoot={active.rightRoot}
            onRoots={(patch) => updateActive(patch)}
            onOpenMerge={setMergeRequest}
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

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
      {passwordFor && (
        <PasswordPrompt target={passwordFor} onSubmit={submitPassword} onCancel={() => setPasswordFor(null)} />
      )}
    </div>
  )
}
