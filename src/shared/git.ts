// Git difftool integration helpers. Pure (no Electron/fs) so they're testable.

export interface DiffPair {
  left: string
  right: string
}

export interface MergeArgs {
  base: string
  local: string
  remote: string
  merged: string
}

/** Parse a `--git-merge <base> <local> <remote> <merged>` invocation. */
export function parseGitMergeArgs(argv: string[]): MergeArgs | null {
  const i = argv.indexOf('--git-merge')
  if (i >= 0 && i + 4 < argv.length) {
    const [base, local, remote, merged] = argv.slice(i + 1, i + 5)
    if (base && local && remote && merged) return { base, local, remote, merged }
  }
  return null
}

/**
 * git config commands to register Juxta as the external merge tool. Juxta is a
 * single-instance GUI: the launched process forwards the merge to the running
 * window and returns immediately, so its exit code can't signal success. We set
 * `trustExitCode false` so git prompts "Was the merge successful?" after you
 * save MERGED and answer — rather than assuming success the instant it launches.
 */
export function gitMergeToolCommands(exePath: string): string {
  const exe = exePath.replace(/\\/g, '/')
  return [
    'git config --global merge.tool juxta',
    `git config --global mergetool.juxta.cmd '"${exe}" --git-merge "$BASE" "$LOCAL" "$REMOTE" "$MERGED"'`,
    'git config --global mergetool.juxta.trustExitCode false'
  ].join('\n')
}

/**
 * Parse a `--git-diff <local> <remote>` invocation out of process argv. Git's
 * difftool launches the configured command with the two file paths; we use an
 * explicit flag so we don't misinterpret other args.
 */
export function parseGitDiffArgs(argv: string[]): DiffPair | null {
  const i = argv.indexOf('--git-diff')
  if (i >= 0 && i + 2 < argv.length) {
    const left = argv[i + 1]
    const right = argv[i + 2]
    if (left && right) return { left, right }
  }
  return null
}

/**
 * The git config commands that register Juxta as the external diff tool.
 * `exePath` is the Juxta executable; forward slashes work in git config on all
 * platforms. Run these in a shell (e.g. Git Bash).
 */
export function gitDiffToolCommands(exePath: string): string {
  const exe = exePath.replace(/\\/g, '/')
  return [
    'git config --global diff.tool juxta',
    `git config --global difftool.juxta.cmd '"${exe}" --git-diff "$LOCAL" "$REMOTE"'`,
    'git config --global difftool.prompt false'
  ].join('\n')
}
