// Map a file path to a Monaco language id for syntax highlighting in the diff.
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'shell',
  bash: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  toml: 'ini',
  ini: 'ini'
}

export function languageForPath(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/)
  if (!m) return 'plaintext'
  return EXT_TO_LANG[m[1]] ?? 'plaintext'
}
