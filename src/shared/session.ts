import { DEFAULT_OPTIONS, type CompareOptions } from './types'

export type SessionType = 'folders' | 'files' | 'text'

/** One open comparison tab. All fields are serializable so sessions persist. */
export interface Session {
  id: string
  type: SessionType
  // folder compare
  leftRoot: string
  rightRoot: string
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
  return 'Text Compare'
}

export const SESSION_ICON: Record<SessionType, string> = {
  folders: '📁',
  files: '📄',
  text: '📝'
}

export const SESSION_LABEL: Record<SessionType, string> = {
  folders: 'Folder Compare',
  files: 'File Compare',
  text: 'Text Compare'
}
