import { DEFAULT_OPTIONS, type CompareOptions } from './types'

export type SessionType = 'folders' | 'files' | 'text' | 'folders3'

/** One open comparison tab. All fields are serializable so sessions persist. */
export interface Session {
  id: string
  type: SessionType
  // folder compare
  leftRoot: string
  rightRoot: string
  /** Common ancestor for a 3-way folder compare. */
  baseRoot: string
  options: CompareOptions
  // file compare
  leftFile: string
  rightFile: string
  // text compare
  leftText: string
  rightText: string
}

export function createSession(type: SessionType, id: string): Session {
  return {
    id,
    type,
    leftRoot: '',
    rightRoot: '',
    baseRoot: '',
    options: DEFAULT_OPTIONS,
    leftFile: '',
    rightFile: '',
    leftText: '',
    rightText: ''
  }
}

function base(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

/** Short label for a session's tab, derived live from its inputs. */
export function sessionTitle(s: Session): string {
  if (s.type === 'folders') {
    const l = base(s.leftRoot)
    const r = base(s.rightRoot)
    return l || r ? `${l || '—'} ⇄ ${r || '—'}` : 'Folder Compare'
  }
  if (s.type === 'files') {
    const l = base(s.leftFile)
    const r = base(s.rightFile)
    return l || r ? `${l || '—'} ⇄ ${r || '—'}` : 'File Compare'
  }
  if (s.type === 'folders3') {
    const l = base(s.leftRoot)
    const r = base(s.rightRoot)
    return l || r ? `${l || '—'} ⇆ ${r || '—'} (3-way)` : '3-Way Folders'
  }
  return 'Text Compare'
}

export const SESSION_ICON: Record<SessionType, string> = {
  folders: '📁',
  files: '📄',
  text: '📝',
  folders3: '🔀'
}

export const SESSION_LABEL: Record<SessionType, string> = {
  folders: 'Folder Compare',
  files: 'File Compare',
  text: 'Text Compare',
  folders3: '3-Way Folders'
}
