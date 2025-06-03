/** Join a root path with a forward-slash relative path, matching the root's separator. */
export function joinPath(root: string, relPath: string): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : root.match(/^[a-zA-Z]:\\/) ? '\\' : '/'
  const normalizedRel = sep === '\\' ? relPath.replace(/\//g, '\\') : relPath
  const trimmedRoot = root.replace(/[\\/]+$/, '')
  return `${trimmedRoot}${sep}${normalizedRel}`
}
