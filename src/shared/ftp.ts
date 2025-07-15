// FTP remote-folder support. A remote side is given as an `ftp://` / `ftps://`
// URL; Juxta mirrors it to a temp folder and then runs the normal local compare.
// Pure URL parsing here (browser-safe, testable).

export interface FtpConfig {
  host: string
  port: number
  user: string
  password: string
  secure: boolean
  /** Remote directory to compare (defaults to '/'). */
  path: string
}

export function isFtpUrl(s: string): boolean {
  return /^ftps?:\/\//i.test(s.trim())
}

/** True when the URL names a (non-anonymous) user but no password — prompt for one. */
export function needsPasswordPrompt(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return (u.protocol === 'ftp:' || u.protocol === 'ftps:') && !!u.username && !u.password
  } catch {
    return false
  }
}

/** Parse `ftp[s]://[user[:pass]@]host[:port][/path]` into a connection config. */
export function parseFtpUrl(url: string): FtpConfig | null {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'ftp:' && u.protocol !== 'ftps:') return null
  const secure = u.protocol === 'ftps:'
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : secure ? 990 : 21,
    user: u.username ? decodeURIComponent(u.username) : 'anonymous',
    password: u.password ? decodeURIComponent(u.password) : 'anonymous@',
    secure,
    path: u.pathname ? decodeURIComponent(u.pathname) : '/'
  }
}
