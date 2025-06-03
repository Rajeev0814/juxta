import picomatch from 'picomatch'

// A minimal but faithful subset of .gitignore semantics:
//  - blank lines and lines starting with '#' are ignored
//  - '!pattern' negates (re-includes) a previously ignored path
//  - a trailing '/' restricts the rule to directories (and their contents)
//  - a leading '/' (or any embedded '/') anchors the pattern to the root;
//    a pattern with no slash matches at any depth
//  - last matching rule wins
// Not supported (documented limitation): per-directory nested .gitignore files,
// and escaped special characters.

export interface IgnoreRule {
  /** picomatch matcher for the entry itself. */
  matchSelf: (p: string) => boolean
  /** picomatch matcher for entries *inside* a matched directory. */
  matchContents: (p: string) => boolean
  negated: boolean
  dirOnly: boolean
}

export interface IgnoreMatcher {
  ignores(relPath: string, isDir: boolean): boolean
}

function buildGlobs(pattern: string): { self: string[]; contents: string[] } {
  // Pattern here has had '!' and trailing '/' already stripped.
  const hasSlash = pattern.includes('/')
  const anchored = pattern.startsWith('/') || (hasSlash && !pattern.startsWith('**'))
  const body = pattern.replace(/^\//, '')
  // Contents globs require a trailing segment so they match entries *inside* a
  // matched directory but not the directory entry itself (picomatch's `a/**`
  // also matches `a`, which we don't want for the self/contents distinction).
  if (anchored) {
    return { self: [body], contents: [`${body}/**/*`] }
  }
  // Unanchored: match at the root and at any depth.
  return { self: [body, `**/${body}`], contents: [`${body}/**/*`, `**/${body}/**/*`] }
}

export function parseIgnore(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '') // trim trailing whitespace
    if (!line || line.startsWith('#')) continue
    const negated = line.startsWith('!')
    let pat = negated ? line.slice(1) : line
    const dirOnly = pat.endsWith('/')
    if (dirOnly) pat = pat.slice(0, -1)
    if (!pat) continue
    const { self, contents } = buildGlobs(pat)
    rules.push({
      matchSelf: picomatch(self, { dot: true }),
      matchContents: picomatch(contents, { dot: true }),
      negated,
      dirOnly
    })
  }
  return rules
}

export function compileIgnore(rules: IgnoreRule[]): IgnoreMatcher {
  return {
    ignores(relPath: string, isDir: boolean): boolean {
      let ignored = false
      for (const r of rules) {
        let matched = false
        if (r.matchContents(relPath)) matched = true
        else if (r.matchSelf(relPath)) matched = !r.dirOnly || isDir
        if (matched) ignored = !r.negated // last match wins
      }
      return ignored
    }
  }
}

/** Convenience: parse + compile in one step. */
export function createIgnoreMatcher(content: string): IgnoreMatcher {
  return compileIgnore(parseIgnore(content))
}
