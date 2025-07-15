// Windows Explorer context-menu integration ("Select Left" / "Compare with
// Selected"). The installer registers two verbs that relaunch Juxta with these
// flags; parsing them here (pure, no Electron) keeps it testable.

function argAfter(argv: string[], flag: string): string | null {
  const i = argv.indexOf(flag)
  if (i >= 0 && i + 1 < argv.length && argv[i + 1]) return argv[i + 1]
  return null
}

/** `--juxta-select <path>` — remember this path as the left side of a compare. */
export function parseSelectLeft(argv: string[]): string | null {
  return argAfter(argv, '--juxta-select')
}

/** `--juxta-compare <path>` — compare this path against the remembered left side. */
export function parseCompareWith(argv: string[]): string | null {
  return argAfter(argv, '--juxta-compare')
}
